/**
 * POST /api/admin/deregister-bot
 * Descadastro completo e automático de um cliente/bot:
 * 1. Deregister do número na Meta (POST /{phone_number_id}/deregister)
 * 2. Deleta conversas, mensagens, contatos
 * 3. Deleta o bot
 * 4. Remove o tenant e tenant_members
 * 5. Remove tokens do Google Contacts
 * 
 * Body: { bot_id: string }  (ou phone_number_id)
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const { bot_id, phone_number_id: providedPhoneId } = req.body

  if (!bot_id && !providedPhoneId) {
    return res.status(400).json({ error: 'bot_id ou phone_number_id é obrigatório' })
  }

  const results = { steps: [] }

  // 1. Buscar o bot
  let query = db.from('bots').select('*')
  if (bot_id) {
    query = query.eq('id', bot_id)
  } else {
    query = query.eq('phone_number_id', providedPhoneId)
  }
  const { data: bots, error: botErr } = await query.limit(1)

  if (botErr || !bots || bots.length === 0) {
    return res.status(404).json({ error: 'Bot não encontrado', detail: botErr?.message })
  }

  const bot = bots[0]
  const botId = bot.id
  const tenantId = bot.tenant_id
  const phoneNumberId = bot.phone_number_id

  results.steps.push({ step: 'find_bot', bot_name: bot.name, phone_number_id: phoneNumberId })

  // 2. Deregister na Meta (se tiver phone_number_id)
  if (phoneNumberId) {
    const metaToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
    if (metaToken) {
      try {
        const metaResp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/deregister`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${metaToken}` },
        })
        const metaData = await metaResp.json()
        
        if (metaData.success === true) {
          results.steps.push({ step: 'meta_deregister', success: true, message: 'Número descadastrado da Meta' })
        } else if (metaData.error?.error_subcode === 133010) {
          // Já estava descadastrado — tudo bem
          results.steps.push({ step: 'meta_deregister', success: true, message: 'Número já estava descadastrado da Meta', already_deregistered: true })
        } else {
          results.steps.push({ step: 'meta_deregister', success: false, error: metaData.error?.message || 'Erro na Meta', result: metaData })
        }
      } catch (e) {
        results.steps.push({ step: 'meta_deregister', error: e.message })
      }
    } else {
      results.steps.push({ step: 'meta_deregister', skipped: 'META_SYSTEM_USER_TOKEN não configurado' })
    }
  }

  // 3. Deletar conversas
  const { error: delConvErr } = await db.from('conversations').delete().eq('bot_id', botId)
  results.steps.push({ step: 'delete_conversations', success: !delConvErr, error: delConvErr?.message })

  // 4. Deletar mensagens
  const { error: delMsgErr } = await db.from('messages').delete().eq('bot_id', botId)
  results.steps.push({ step: 'delete_messages', success: !delMsgErr, error: delMsgErr?.message })

  // 5. Deletar contatos sincronizados
  if (tenantId) {
    const { error: delContactsErr } = await db.from('contacts').delete().eq('tenant_id', tenantId)
    results.steps.push({ step: 'delete_contacts', success: !delContactsErr, error: delContactsErr?.message })

    // 6. Deletar google_contacts_auth
    const { error: delGoogleErr } = await db.from('google_contacts_auth').delete().eq('tenant_id', tenantId)
    results.steps.push({ step: 'delete_google_auth', success: !delGoogleErr, error: delGoogleErr?.message })
  }

  // 7. Deletar webhook events (se existir tabela)
  try {
    await db.from('webhook_events').delete().eq('bot_id', botId)
    results.steps.push({ step: 'delete_webhook_events', success: true })
  } catch {
    // tabela pode não existir
  }

  // 8. Deletar o bot
  const { error: delBotErr } = await db.from('bots').delete().eq('id', botId)
  results.steps.push({ step: 'delete_bot', success: !delBotErr, error: delBotErr?.message })

  // 9. Deletar tenant (se não for o Arkiel principal)
  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  if (tenantId && tenantId !== ARKIEL_TENANT_ID) {
    // Deletar tenant_members
    const { error: delMembersErr } = await db.from('tenant_members').delete().eq('tenant_id', tenantId)
    results.steps.push({ step: 'delete_tenant_members', success: !delMembersErr, error: delMembersErr?.message })

    // Deletar tenant
    const { data: tenantData, error: tenantQueryErr } = await db.from('tenants').select('name').eq('id', tenantId).limit(1)
    const tenantName = tenantData?.[0]?.name || 'desconhecido'
    
    const { error: delTenantErr } = await db.from('tenants').delete().eq('id', tenantId)
    results.steps.push({ 
      step: 'delete_tenant', 
      tenant_name: tenantName,
      success: !delTenantErr, 
      error: delTenantErr?.message 
    })
  } else if (tenantId === ARKIEL_TENANT_ID) {
    results.steps.push({ step: 'delete_tenant', skipped: 'É o tenant principal da Arkiel — não deletado' })
  }

  // Resumo
  const successCount = results.steps.filter(s => s.success).length
  const failCount = results.steps.filter(s => s.success === false).length

  return res.status(200).json({
    ok: true,
    message: `Descadastro concluído. ${successCount} etapas ok, ${failCount} com erro.`,
    bot_name: bot.name,
    phone_number_id: phoneNumberId,
    results
  })
}
