/**
 * /api/webhook — Webhook oficial da Meta (WhatsApp Business API)
 *
 * GET  → verificação do endpoint (Meta challenge)
 * POST → recebimento de mensagens em tempo real
 *
 * Configure no Meta for Developers:
 * WhatsApp → Configuration → Webhook URL: https://arkiel.com.br/api/webhook
 * Verify Token: configurado em WEBHOOK_VERIFY_TOKEN no .env
 */
import { supabaseAdmin }   from '../../../lib/supabase'
import { sendText, sendButtons, markRead } from '../../../lib/meta'
import { processMessage }  from '../../../lib/flowEngine'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  // ── GET: verificação Meta ──────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret')) {
      console.log('[webhook] ✅ Meta verificou o endpoint')
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  // ── POST: mensagem recebida ────────────────────────────────
  if (req.method !== 'POST') return res.status(405).end()

  // Responde 200 imediatamente (Meta requer < 5s)
  res.status(200).end()

  try {
    const body   = req.body
    const entry  = body?.entry?.[0]
    const change = entry?.changes?.[0]?.value

    // Pular status updates (delivered, read, etc.)
    if (change?.statuses?.length) return
    const msgs = change?.messages
    if (!msgs?.length) return

    const msg           = msgs[0]
    const fromRaw        = msg.from
    // Normalizar número brasileiro: 55 + DDD + 9 + número (13 dígitos)
    const from = fromRaw.startsWith('55') && fromRaw.length === 12
      ? fromRaw.slice(0, 4) + '9' + fromRaw.slice(4)
      : fromRaw
    const phoneNumberId = change?.metadata?.phone_number_id
    const wamId         = msg.id

    // Extrair texto da mensagem (texto, botão interativo ou lista)
    let userText = ''
    if (msg.type === 'text')        userText = msg.text?.body || ''
    else if (msg.type === 'button') userText = msg.button?.text || msg.button?.payload || ''
    else if (msg.type === 'interactive') {
      const br = msg.interactive?.button_reply
      const lr = msg.interactive?.list_reply
      userText = br?.title || br?.id || lr?.title || lr?.id || ''
    }

    const db = supabaseAdmin()

    // 1. Busca bot pelo phone_number_id
    const { data: bot, error: botErr } = await db
      .from('bots')
      .select('*, tenants(id, plan, status, max_messages_month)')
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .maybeSingle()

    if (!bot) {
      console.warn('[webhook] Nenhum bot ativo para phone_number_id:', phoneNumberId)
      return
    }

    if (bot.tenants?.status !== 'active') {
      console.warn('[webhook] Tenant suspenso:', bot.tenant_id)
      return
    }

    const tenantId = bot.tenant_id
    const month    = new Date().toISOString().slice(0, 7)

    // 2. Verifica limite de mensagens
    const { data: usageRow } = await db
      .from('usage').select('messages')
      .eq('tenant_id', tenantId).eq('month', month)
      .maybeSingle()

    const maxMsg  = bot.tenants?.max_messages_month || 500
    const usedMsg = usageRow?.messages || 0

    if (usedMsg >= maxMsg) {
      await sendText(bot.phone_number_id, bot.access_token, from,
        '⚠️ Limite de mensagens do plano atingido. Para continuar, entre em contato com o suporte.')
      return
    }

    // 3. Incrementa uso
    await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: month })

    // 4. Marca como lida
    await markRead(bot.phone_number_id, bot.access_token, wamId).catch(() => {})

    // 5. Upsert contato
    const contactName = change?.contacts?.[0]?.profile?.name || ''
    const { data: contact } = await db
      .from('contacts')
      .upsert(
        { tenant_id: tenantId, phone: from, name: contactName || undefined, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,phone' }
      )
      .select().single()

    // 6. Busca ou cria conversa ativa
    let { data: conv } = await db
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bot_id', bot.id)
      .eq('contact_id', contact.id)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conv) {
      const { data: newConv } = await db
        .from('conversations')
        .insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' })
        .select().single()
      conv = newConv
    }

    // 7. Salva mensagem inbound
    await db.from('messages').insert({
      tenant_id:       tenantId,
      conversation_id: conv.id,
      bot_id:          bot.id,
      contact_id:      contact.id,
      direction:       'inbound',
      type:            msg.type,
      content:         userText || `[${msg.type}]`,
      meta_message_id: wamId
    })

    // 8. Verifica human takeover
    if (conv.status === 'human') {
      // Em modo humano, apenas salva — não responde automaticamente
      await db.from('conversations')
        .update({ last_message: userText, last_message_at: new Date().toISOString() })
        .eq('id', conv.id)
      return
    }

    // 9. Keyword de transferência para humano
    if (bot.human_takeover_keyword &&
        userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
      await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
      const reply = '👤 Transferindo para um atendente. Aguarde um momento.'
      await sendText(bot.phone_number_id, bot.access_token, from, reply)
      await db.from('messages').insert({
        tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
        contact_id: contact.id, direction: 'outbound', content: reply
      })
      return
    }

    // 10. Processa fluxo e envia resposta
    const { reply, node } = await processMessage(bot, conv, userText, {
      supabase: db,
      sendFn: async (text) => sendText(bot.phone_number_id, bot.access_token, from, text)
    })

    // Envia botões se o nó tiver opções
    if (node?.type === 'menu' && node.options?.length) {
      const opts = node.options.slice(0, 3)
      if (opts.length <= 3) {
        await sendButtons(bot.phone_number_id, bot.access_token, from, reply,
          opts.map((o, i) => ({ id: o.id || `opt_${i}`, title: o.label?.substring(0,20) || `Opção ${i+1}` })))
      } else {
        await sendText(bot.phone_number_id, bot.access_token, from, reply)
      }
    } else {
      await sendText(bot.phone_number_id, bot.access_token, from, reply)
    }

    // 11. Salva mensagem outbound
    await db.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
      contact_id: contact.id, direction: 'outbound', content: reply
    })

    // 12. Atualiza conversa
    await db.from('conversations').update({
      last_message:    reply,
      last_message_at: new Date().toISOString(),
      current_node_id: node?.id || null
    }).eq('id', conv.id)

  } catch (err) {
    console.error('[webhook] Erro fatal:', err)
  }
}
