/**
 * /api/webhook — Webhook oficial da Meta (WhatsApp Business API)
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { sendText, sendButtons, markRead } from '../../../lib/meta'
import { processMessage } from '../../../lib/flowEngine'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  // ── GET: verificação Meta ──────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025')) {
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  if (req.method !== 'POST') return res.status(405).end()

  // Responde 200 imediatamente (Meta requer < 5s)
  res.status(200).end()

  const errors = []

  try {
    const body   = req.body
    const entry  = body?.entry?.[0]
    const change = entry?.changes?.[0]?.value

    if (change?.statuses?.length) return
    const msgs = change?.messages
    if (!msgs?.length) return

    const msg           = msgs[0]
    const fromRaw       = msg.from
    // Normalizar número BR: se 55 + 10 dígitos (sem o 9), adiciona o 9
    const from = fromRaw.startsWith('55') && fromRaw.length === 12
      ? fromRaw.slice(0, 4) + '9' + fromRaw.slice(4)
      : fromRaw

    const phoneNumberId = change?.metadata?.phone_number_id
    const wamId         = msg.id

    let userText = ''
    if (msg.type === 'text')        userText = msg.text?.body || ''
    else if (msg.type === 'button') userText = msg.button?.text || msg.button?.payload || ''
    else if (msg.type === 'interactive') {
      const br = msg.interactive?.button_reply
      const lr = msg.interactive?.list_reply
      userText = br?.title || br?.id || lr?.title || lr?.id || ''
    }

    let db
    try {
      db = supabaseAdmin()
    } catch (e) {
      console.error('[webhook] Erro ao criar supabaseAdmin:', e.message)
      return
    }

    // 1. Busca bot
    const { data: botArr, error: botErr } = await db
      .from('bots')
      .select('*, tenants(id, plan, status, max_messages_month)')
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .limit(1)

    if (botErr) { console.error('[webhook] Erro ao buscar bot:', botErr.message); return }
    const bot = botArr?.[0]
    if (!bot) { console.warn('[webhook] Nenhum bot ativo para:', phoneNumberId); return }
    if (bot.tenants?.status !== 'active') { console.warn('[webhook] Tenant suspenso'); return }

    const tenantId = bot.tenant_id
    const month    = new Date().toISOString().slice(0, 7)

    // 2. Verifica limite
    const { data: usageRow } = await db
      .from('usage').select('messages')
      .eq('tenant_id', tenantId).eq('month', month)
      .maybeSingle()

    const maxMsg  = bot.tenants?.max_messages_month || 500
    const usedMsg = usageRow?.messages || 0

    if (usedMsg >= maxMsg) {
      await sendText(bot.phone_number_id, bot.access_token, from,
        '⚠️ Limite de mensagens atingido. Entre em contato com o suporte.')
      return
    }

    // 3. Incrementa uso
    await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: month }).catch(e => {
      console.error('[webhook] increment_usage erro:', e.message)
    })

    // 4. Marca como lida
    await markRead(bot.phone_number_id, bot.access_token, wamId).catch(() => {})

    // 5. Upsert contato
    const contactName = change?.contacts?.[0]?.profile?.name || ''
    const { data: contact, error: contactErr } = await db
      .from('contacts')
      .upsert(
        { tenant_id: tenantId, phone: from, name: contactName || undefined, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,phone' }
      )
      .select().single()

    if (contactErr) { console.error('[webhook] Erro upsert contato:', contactErr.message); return }

    // 6. Busca ou cria conversa
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
      const { data: newConv, error: convErr } = await db
        .from('conversations')
        .insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' })
        .select().single()
      if (convErr) { console.error('[webhook] Erro criar conversa:', convErr.message); return }
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
    }).then(({ error: e }) => { if (e) console.error('[webhook] Erro salvar msg inbound:', e.message) })

    // 8. Human takeover check
    if (conv.status === 'human') {
      await db.from('conversations').update({ last_message: userText, last_message_at: new Date().toISOString() }).eq('id', conv.id)
      return
    }

    // 9. Keyword para humano
    if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
      await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
      const reply = '👤 Transferindo para um atendente. Aguarde um momento.'
      await sendText(bot.phone_number_id, bot.access_token, from, reply)
      await db.from('messages').insert({ tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', content: reply })
      return
    }

    // 10. Processa fluxo
    const { reply, node } = await processMessage(bot, conv, userText, {
      supabase: db,
      sendFn: async (text) => sendText(bot.phone_number_id, bot.access_token, from, text)
    })

    // 11. Envia resposta
    if (node?.type === 'menu' && node.options?.length && node.options.length <= 3) {
      await sendButtons(bot.phone_number_id, bot.access_token, from, reply,
        node.options.slice(0, 3).map((o, i) => ({ id: o.id || `opt_${i}`, title: o.label?.substring(0, 20) || `Opção ${i+1}` })))
    } else {
      const { error: sendErr } = await sendText(bot.phone_number_id, bot.access_token, from, reply)
        .catch(e => ({ error: e }))
      if (sendErr) console.error('[webhook] Erro ao enviar resposta:', sendErr?.message || sendErr)
    }

    // 12. Salva mensagem outbound
    await db.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
      contact_id: contact.id, direction: 'outbound', content: reply
    }).then(({ error: e }) => { if (e) console.error('[webhook] Erro salvar msg outbound:', e.message) })

    // 13. Atualiza conversa
    await db.from('conversations').update({
      last_message: reply, last_message_at: new Date().toISOString(), current_node_id: node?.id || null
    }).eq('id', conv.id)

    console.log('[webhook] ✅ Mensagem processada de', from, '→ reply:', reply?.substring(0, 50))

  } catch (err) {
    console.error('[webhook] Erro fatal:', err?.message || err, err?.stack?.substring(0, 300))
  }
}
