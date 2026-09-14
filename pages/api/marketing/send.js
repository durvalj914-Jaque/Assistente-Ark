import { requireTenant } from '../../../lib/serverAuth'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

/**
 * POST /api/marketing/send
 * Body: { tenant_id, message, contacts: ['5511...', ...], image_url (opcional) }
 * 
 * Envia uma mensagem de marketing via template do WhatsApp.
 * Cada contato consome 1 crédito de marketing (R$0,36).
 * Usa o template hello_world como fallback se não houver template de marketing aprovado.
 */
export default async function handler(req, res) {
  const auth = await requireTenant(req, res)
  if (!auth) return
  if (req.query) req.query.tenant_id = auth.tenant_id
  if (req.body) { req.body.tenant_id = auth.tenant_id; req.body.tenantId = auth.tenant_id }
  if (req.query && !req.query.tenantId) req.query.tenantId = auth.tenant_id
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id, message, contacts, image_url } = req.body

  if (!tenant_id || !message || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'tenant_id, message e contacts são obrigatórios' })
  }

  const db = getDB()

  // 0. Contatos "quentes" (mandaram msg pro bot nas últimas 24h) podem receber
  // texto livre direto — sem template, sem custo da Meta e sem debitar crédito
  const warmIds = new Set()
  try {
    const { data: contactRows } = await db.from('contacts')
      .select('id, phone')
      .eq('tenant_id', tenant_id)
      .in('phone', contacts)
    const ids = (contactRows || []).map(c => c.id)
    const phoneById = {}
    ;(contactRows || []).forEach(c => { phoneById[c.id] = c.phone })
    if (ids.length) {
      const { data: inboundRows } = await db.from('messages')
        .select('contact_id')
        .eq('tenant_id', tenant_id)
        .eq('direction', 'inbound')
        .gt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .in('contact_id', ids)
      ;(inboundRows || []).forEach(r => { if (phoneById[r.contact_id]) warmIds.add(phoneById[r.contact_id]) })
    }
  } catch (e) { console.error('[marketing/send] erro ao buscar contatos quentes:', e.message) }

  // 1. Verificar saldo de créditos de marketing (só contatos frios consomem)
  const { data: creditRow } = await db.from('conversation_credits')
    .select('balance')
    .eq('tenant_id', tenant_id)
    .eq('credit_type', 'marketing')
    .maybeSingle()

  const balance = creditRow?.balance || 0
  const coldCount = contacts.filter(p => !warmIds.has(p)).length
  if (balance < coldCount) {
    return res.status(402).json({
      error: `Créditos de marketing insuficientes. Você tem ${balance} créditos e está tentando enviar para ${coldCount} contatos.`,
      balance,
      needed: coldCount,
    })
  }

  // 2. Buscar bot do tenant
  const { data: bot } = await db.from('bots')
    .select('id,phone_number_id,access_token,tenant_id')
    .eq('tenant_id', tenant_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!bot) {
    return res.status(404).json({ error: 'Nenhum bot ativo encontrado para este tenant' })
  }

  const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
  const phoneId = bot.phone_number_id

  // 3. Buscar templates de marketing aprovados
  // Por agora, usar template hello_world como fallback
  // TODO: criar template customizado de marketing e usar ele
  let templateName = 'hello_world'
  let templateLanguage = 'en_US'
  let templateHasVar = false // template customizado tem variável {{1}} no corpo?
  let templateIsExact = false // template aprovado cujo corpo é a própria mensagem
  let pendingSameBody = false // mensagem já está em revisão na Meta

  // Tentar buscar template de marketing customizado
  try {
    const templatesRes = await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WABA_ID || '1867398900635798'}/message_templates?fields=name,language,status,category,components&limit=100`,
      { headers: { Authorization: `Bearer ${waToken}` } }
    )
    const templatesData = await templatesRes.json()
    
    const norm = s => (s || '').replace(/\{\{\d+\}\}/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
    const msgNorm = norm(message)
    const bodyOf = t => (t.components || []).find(c => c.type === 'BODY')?.text || ''
    const allMarketing = (templatesData.data || []).filter(t => t.category === 'MARKETING')
    const approved = allMarketing.filter(t => t.status === 'APPROVED')

    // 1º: template aprovado cujo corpo É exatamente a mensagem (criado pelo
    // auto-submit) → chega 1 única mensagem com o texto programado, sem wrapper
    const exact = approved.find(t => norm(bodyOf(t)) === msgNorm && !/\{\{\d+\}\}/.test(bodyOf(t)))
    if (exact) {
      templateName = exact.name
      templateLanguage = exact.language
      templateIsExact = true
    } else {
      // 2º: template com variável {{1}} → mensagem vai dentro dele
      const withVar = approved.find(t => /\{\{\d+\}\}/.test(bodyOf(t)))
      if (withVar) {
        templateName = withVar.name
        templateLanguage = withVar.language
        templateHasVar = true
      } else {
        // 3º: qualquer aprovado (wrapper fixo + follow-up com a mensagem real)
        const first = approved[0]
        if (first) { templateName = first.name; templateLanguage = first.language }
      }
    }
    // já existe essa mensagem em revisão (PENDING)? não re-submeter
    pendingSameBody = allMarketing.some(t => t.status === 'PENDING' && norm(bodyOf(t)) === msgNorm)
  } catch (e) {
    console.error('[marketing/send] Erro ao buscar templates:', e.message)
  }

  // 4. Enviar mensagens
  let sent = 0
  let failed = 0
  const errors = []

  let debited = 0
  let warm = 0
  for (const phone of contacts) {
    try {
      // Contato quente → mensagem livre direto (Meta não cobra, não debita crédito)
      if (warmIds.has(phone)) {
        const warmBody = image_url
          ? { messaging_product: 'whatsapp', to: phone, type: 'image', image: { link: image_url, caption: message.substring(0, 1024) } }
          : { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message.substring(0, 4096) } }
        const warmRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
          body: JSON.stringify(warmBody),
        })
        const warmData = await warmRes.json()
        if (warmData?.messages?.[0]?.id) { sent++; warm++; continue }
        errors.push({ phone, error: warmData.error?.message || JSON.stringify(warmData).substring(0, 150) })
        failed++
        continue
      }

      let body
      if (templateIsExact) {
        // O corpo do template É a mensagem programada — 1 única mensagem, texto exato
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: { name: templateName, language: { code: templateLanguage } },
        }
      } else
      if (templateName === 'hello_world') {
        // Template padrão — não suporta variáveis, envia como está
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
          },
        }
        // Se tem mensagem customizada, usar template com body
        if (message && message !== 'hello_world') {
          // Enviar como texto normal dentro da janela 24h se possível
          // Senão, usar template hello_world e depois enviar a mensagem
          body.template = {
            name: templateName,
            language: { code: templateLanguage },
          }
        }
      } else if (image_url) {
        // Com imagem: o template só abre a janela 24h; o conteúdo real (imagem+caption) vai depois
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
          },
        }
      } else {
        // Template de marketing customizado: só injeta a mensagem como parâmetro
        // se o corpo do template tiver variável {{1}} — template sem variável com
        // parâmetro extra é rejeitado pela Meta (erro do envio "teste_simples")
        const template = { name: templateName, language: { code: templateLanguage } }
        if (templateHasVar) {
          template.components = [{
            type: 'body',
            parameters: [{ type: 'text', text: message.substring(0, 1024) }],
          }]
        }
        body = { messaging_product: 'whatsapp', to: phone, type: 'template', template }
      }

      const sendRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
        body: JSON.stringify(body),
      })
      const sendData = await sendRes.json()

      // Cloud API responde { messages: [{ id: 'wamid...' }] } no sucesso —
      // sendData.id/message_status não existem nesse shape e faziam sucesso
      // ser contado como falha (follow-up da mensagem real nunca disparava)
      const wamid = sendData?.messages?.[0]?.id
      if (wamid || sendData.message_status === 'accepted') {
        sent++
        // Debita 1 crédito de marketing + registra janela de conversa (conferência com a Meta)
        try {
          await db.rpc('deduct_credit', {
            p_tenant_id: tenant_id, p_credit_type: 'marketing',
            p_conversation_id: wamid, p_origin_type: 'marketing',
            p_bot_id: bot.id, p_contact_phone: phone,
          })
          await db.rpc('track_conversation', {
            p_conversation_id: wamid, p_tenant_id: tenant_id,
            p_bot_id: bot.id, p_origin_type: 'marketing',
            p_category: 'marketing', p_phone_number: phone,
          })
          debited++
        } catch (e) {
          console.error('[marketing/send] erro ao debitar crédito/rastrear janela:', e.message)
        }
        // Follow-up com o conteúdo real de marketing (após abrir a janela 24h)
        try {
          if (image_url) {
            // 🖼️ Enviar imagem com a mensagem como legenda
            await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
              body: JSON.stringify({
                messaging_product: 'whatsapp', to: phone, type: 'image',
                image: { link: image_url, caption: message.substring(0, 1024) },
              }),
            })
          } else if (!templateHasVar && !templateIsExact && message) {
            // Enviar a mensagem de marketing como texto (após abrir a janela com o template)
            await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
              body: JSON.stringify({
                messaging_product: 'whatsapp', to: phone, type: 'text',
                text: { body: message.substring(0, 4096) },
              }),
            })
          }
        } catch (_) {}
      } else {
        failed++
        errors.push({ phone, error: sendData.error?.message || JSON.stringify(sendData).substring(0, 150) })
      }
    } catch (e) {
      failed++
      errors.push({ phone, error: e.message })
    }

    // Pequeno delay para não estourar rate limit da Meta
    if (sent % 10 === 0 && sent > 0) await new Promise(r => setTimeout(r, 500))
  }

  // 5a. Auto-submeter a mensagem como template de marketing na Meta — depois de
  // aprovado (minutos/horas), o próximo envio dessa mesma mensagem sai como 1
  // única msg com o texto exato, sem o wrapper "Voce tem uma nova notificacao"
  let templateSubmitted = false
  try {
    if (!templateIsExact && !pendingSameBody && message && message.length <= 1024
        && !/\{\{\d+\}\}/.test(message) && !/\n\s*\n\s*\n/.test(message)) {
      const createRes = await fetch(`https://graph.facebook.com/v25.0/${process.env.WABA_ID || '1867398900635798'}/message_templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
        body: JSON.stringify({
          name: `msg_ark_${Date.now().toString(36)}`,
          language: 'pt_BR',
          category: 'MARKETING',
          components: [{ type: 'BODY', text: message.substring(0, 1024) }],
        }),
      })
      const createData = await createRes.json()
      templateSubmitted = Boolean(createData.id)
      if (!templateSubmitted) console.error('[marketing/send] auto-submit de template falhou:', JSON.stringify(createData).substring(0, 250))
    }
  } catch (e) { console.error('[marketing/send] erro no auto-submit de template:', e.message) }

  // 5. Registrar no log (analytics_events + webhook_logs — activity_logs não existe mais)
  try {
    if (sent > 0) {
      await db.from('analytics_events').insert({
        tenant_id,
        event_type: 'marketing_broadcast',
        bot_id: bot.id,
        value_brl: debited * 0.36,
        payload: { sent, failed, template: templateName, has_image: Boolean(image_url), message_preview: message.substring(0, 100) },
      })
    }
  } catch (e) { console.error('[marketing/send] erro ao registrar analytics:', e.message) }
  try {
    await db.from('webhook_logs').insert({
      step: 'marketing_broadcast',
      error: `enviado para ${sent} contatos (${failed} falhas${warm ? `, ${warm} quente(s) sem template` : ''}) — template: ${templateName}` + (templateSubmitted ? ' — mensagem submetida p/ revisão na Meta (aprovada, próximos envios saem como 1 msg única)' : '') + (errors.length ? ` — erros: ${errors.map(e => e.error).join(' | ').substring(0, 200)}` : ''),
    })
  } catch (_) {}

  return res.status(200).json({
    ok: true,
    sent,
    failed,
    template_used: templateName,
    errors: errors.slice(0, 5), // primeiros 5 erros apenas
  })
}
