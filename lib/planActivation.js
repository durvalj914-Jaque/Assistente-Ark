/**
 * lib/planActivation.js
 * Ativa um plano no tenant do cliente após pagamento confirmado.
 * Lê os recursos do plano e aplica os limites/configurações no tenant.
 */

const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

/**
 * Extrai limites dos recursos baseado nos nomes.
 * Interpreta recursos como "1 Bot Ativo", "5.000 mensagens/mês", etc.
 */
export function parseResourceLimits(resourceNames = []) {
  const limits = {
    max_bots: 0,
    max_messages_month: 0,
    max_conversations_month: 0,
    max_contacts: 0,
    has_catalog: false,
    has_pix: false,
    has_mercadopago: false,
    has_flow_editor: false,
    has_ai: false,
    has_human_transfer: false,
    has_push: false,
    has_multiuser: false,
    has_google_import: false,
    has_api: false,
    has_reports: false,
    storage_gb: 0,
    support_level: 'none', // none | email | priority
    has_dedicated_number: false,
    features: [],
  }

  for (const name of (resourceNames || [])) {
    const lower = (name || '').toLowerCase()

    // Bots
    const botMatch = lower.match(/(\d+)\s*bots?\s*ativo/)
    if (botMatch) { limits.max_bots = Math.max(limits.max_bots, parseInt(botMatch[1])); continue }
    if (lower.includes('bots ilimitad') || lower.includes('ilimitad') && lower.includes('bot')) { limits.max_bots = 999; continue }

    // Mensagens
    const msgMatch = lower.match(/(\d+\.?\d*)\s*mil\s*mensagens/) || lower.match(/(\d+)\s*mensagens/)
    if (msgMatch) {
      let val = parseInt(msgMatch[1].replace('.', ''))
      if (lower.includes('mil') && val < 1000) val = val * 1000
      limits.max_messages_month = Math.max(limits.max_messages_month, val)
      continue
    }
    if (lower.includes('mensagens ilimitad')) { limits.max_messages_month = 999999; continue }

    // Conversas iniciadas (business-initiated)
    const convMatch = lower.match(/(\d+\.?\d*)\s*mil\s*conversas/) || lower.match(/(\d+)\s*conversas/)
    if (convMatch) {
      let val = parseInt(convMatch[1].replace('.', ''))
      if (lower.includes('mil') && val < 1000) val = val * 1000
      limits.max_conversations_month = Math.max(limits.max_conversations_month, val)
      continue
    }
    if (lower.includes('conversas ilimitad')) { limits.max_conversations_month = 999999; continue }
    // Se tem "conversas iniciadas" no nome do recurso, extrair o número
    if (lower.includes('conversa') && lower.includes('iniciad')) {
      const numMatch = lower.match(/(\d+)/)
      if (numMatch) { limits.max_conversations_month = Math.max(limits.max_conversations_month, parseInt(numMatch[1])); continue }
    }

    // Contatos
    const contactMatch = lower.match(/(\d+\.?\d*)\s*contatos/)
    if (contactMatch) {
      let val = parseInt(contactMatch[1].replace('.', ''))
      if (lower.includes('mil') && val < 1000) val = val * 1000
      limits.max_contacts = Math.max(limits.max_contacts, val)
      continue
    }
    if (lower.includes('contatos ilimitad')) { limits.max_contacts = 999999; continue }

    // Catálogo
    if (lower.includes('catálogo') || lower.includes('catalogo')) { limits.has_catalog = true; limits.features.push('Catálogo de Produtos'); continue }

    // PIX
    if (lower.includes('pix')) { limits.has_pix = true; limits.features.push('Pagamentos via PIX'); continue }

    // Mercado Pago
    if (lower.includes('mercado pago') || lower.includes('mercadopago')) { limits.has_mercadopago = true; limits.features.push('Pagamentos Mercado Pago'); continue }

    // Flow Editor
    if (lower.includes('flow editor') || lower.includes('editor de fluxo')) { limits.has_flow_editor = true; limits.features.push('Flow Editor Avançado'); continue }

    // IA
    if (lower.includes('ia') && !lower.includes('pix')) { limits.has_ai = true; limits.features.push('Respostas com IA'); continue }
    if (lower.includes('openai') || lower.includes('intelig')) { limits.has_ai = true; limits.features.push('Respostas com IA'); continue }

    // Humano
    if (lower.includes('humano') || lower.includes('atendente')) { limits.has_human_transfer = true; limits.features.push('Transferência para Humano'); continue }

    // Push
    if (lower.includes('push') || lower.includes('notific')) { limits.has_push = true; limits.features.push('Notificações Web Push'); continue }

    // Multiusuário
    if (lower.includes('multiusuário') || lower.includes('multiusuario')) { limits.has_multiuser = true; limits.features.push('Multiusuário'); continue }

    // Google
    if (lower.includes('google')) { limits.has_google_import = true; limits.features.push('Importação Google'); continue }

    // API
    if (lower.includes('api') && !lower.includes('mercadopago')) { limits.has_api = true; limits.features.push('Acesso à API'); continue }

    // Relatórios
    if (lower.includes('relatório') || lower.includes('relatorio')) { limits.has_reports = true; limits.features.push('Relatórios Avançados'); continue }

    // Storage
    const storageMatch = lower.match(/(\d+)\s*gb/)
    if (storageMatch) { limits.storage_gb = Math.max(limits.storage_gb, parseInt(storageMatch[1])); limits.features.push(`Armazenamento ${storageMatch[1]}GB`); continue }

    // Suporte
    if (lower.includes('suporte priorit')) { limits.support_level = 'priority'; limits.features.push('Suporte Prioritário'); continue }
    if (lower.includes('suporte') && lower.includes('email')) { limits.support_level = 'email'; limits.features.push('Suporte por Email'); continue }

    // Número dedicado
    if (lower.includes('dedicad') || lower.includes('número whatsapp')) { limits.has_dedicated_number = true; limits.features.push('Número WhatsApp Dedicado'); continue }
  }

  return limits
}

/**
 * Ativa um plano no tenant do cliente.
 * Chamado pelo webhook quando pagamento é confirmado.
 */
export async function activatePlan(db, payment) {
  // Ler metadata do pagamento
  let meta = {}
  try { meta = JSON.parse(payment.pix_qr_url || '{}') } catch { return { ok: false, error: 'Sem metadata' } }

  if (meta.type !== 'plan_subscription') return { ok: false, skipped: true }

  const { plan_id, plan_name, tenant_id, expires_at, resource_ids, resource_names } = meta

  if (!tenant_id) return { ok: false, error: 'Sem tenant_id' }

  // Parsear limites dos recursos
  const limits = parseResourceLimits(resource_names)

  // Montar objeto de subscription para salvar no tenant
  const subscription = {
    plan_id,
    plan_name,
    billing_cycle: meta.billing_cycle,
    activated_at: new Date().toISOString(),
    expires_at: expires_at,
    resource_ids: resource_ids || [],
    limits,
    status: 'active',
  }

  // Atualizar tenant com o plano ativo
  const updates = {
    plan: plan_name.toLowerCase().replace(/\s+/g, '_'),
    plan_expires_at: expires_at,
    status: 'active',
    subscription: JSON.stringify(subscription),
  }

  const { error } = await db.from('tenants').update(updates).eq('id', tenant_id)

  if (error) {
    console.error('[planActivation] Erro ao atualizar tenant:', error)
    return { ok: false, error: error.message }
  }

  // Log de ativação
  try {
    await db.from('activity_logs').insert({
      tenant_id,
      event_type: 'plan_activated',
      description: `Plano "${plan_name}" ativado — ${resource_names?.length || 0} recursos`,
      metadata: JSON.stringify({ plan_id, resource_names, expires_at }),
    })
  } catch {}

  // Notificar cliente via WhatsApp se tiver bot
  try {
    const { data: bot } = await db.from('bots')
      .select('phone_number_id, access_token')
      .eq('tenant_id', tenant_id)
      .limit(1)
      .maybeSingle()

    if (bot?.phone_number_id) {
      const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
      const msg = `🎉 *Plano ${plan_name} Ativado!*\n\n✅ Seu plano foi ativado com sucesso.\n📊 Recursos liberados:\n${(limits.features || []).map(f => '• ' + f).join('\n')}\n${expires_at ? `\n⏰ Válido até: ${new Date(expires_at).toLocaleDateString('pt-BR')}` : '\n♾️ Vigência: Vitalícia'}\n\nBom trabalho! 🚀`

      await fetch(`https://graph.facebook.com/v25.0/${bot.phone_number_id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: tenant_id, type: 'text', text: { body: msg } }),
      }).catch(() => {})
    }
  } catch {}

  return { ok: true, subscription }
}

/**
 * Verifica se um tenant tem um recurso ativo no plano.
 */
export function hasFeature(tenant, feature) {
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch { return false }
  if (sub.status !== 'active') return false
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) return false
  return sub.limits?.[feature] === true || (typeof sub.limits?.[feature] === 'number' && sub.limits[feature] > 0)
}

/**
 * Verifica limites de uso do tenant.
 */
export function checkTenantLimit(tenant, usage, botCount, field) {
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch {}
  if (!sub || sub.status !== 'active') {
    // Fallback para plano free
    return field === 'messages' ? (usage?.messages || 0) < 500
         : field === 'bots' ? botCount < 1
         : true
  }
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) return false

  const limits = sub.limits || {}
  if (field === 'messages') return (usage?.business_initiated_conversations || 0) < (limits.max_conversations_month || limits.max_messages_month || 0)
  if (field === 'conversations') return (usage?.business_initiated_conversations || 0) < (limits.max_conversations_month || 0)
  if (field === 'bots') return botCount < (limits.max_bots || 0)
  if (field === 'contacts') return (usage?.contacts || 0) < (limits.max_contacts || 999999)
  return true
}
