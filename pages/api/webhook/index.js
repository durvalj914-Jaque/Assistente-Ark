import { createClient } from '@supabase/supabase-js'
import { sendText, sendButtons, markRead } from '../../../lib/meta'
import { processMessage } from '../../../lib/flowEngine'

export const config = { api: { bodyParser: true } }

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

async function log(step, error, payload) {
  try {
    await db().from('webhook_logs').insert({ step, error: String(error||''), payload: payload||null })
  } catch(e) {}
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025')) {
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  if (req.method !== 'POST') return res.status(405).end()
  res.status(200).end()

  try {
    const body   = req.body
    const change = body?.entry?.[0]?.changes?.[0]?.value

    await log('received', null, body)

    if (change?.statuses?.length) return
    const msgs = change?.messages
    if (!msgs?.length) { await log('no_messages', 'no messages in payload', body); return }

    const msg           = msgs[0]
    const fromRaw       = msg.from
    const from          = (fromRaw.startsWith('55') && fromRaw.length === 12)
                          ? fromRaw.slice(0,4) + '9' + fromRaw.slice(4)
                          : fromRaw
    const phoneNumberId = change?.metadata?.phone_number_id
    const wamId         = msg.id

    let userText = ''
    if (msg.type === 'text') userText = msg.text?.body || ''
    else if (msg.type === 'button') userText = msg.button?.text || msg.button?.payload || ''
    else if (msg.type === 'interactive') {
      const br = msg.interactive?.button_reply
      const lr = msg.interactive?.list_reply
      userText = br?.title || br?.id || lr?.title || lr?.id || ''
    }

    await log('parsed', null, { from, phoneNumberId, userText })

    const client = db()

    // 1. Bot
    const { data: botArr, error: botErr } = await client
      .from('bots')
      .select('*, tenants(id, plan, status, max_messages_month)')
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .limit(1)

    if (botErr) { await log('bot_error', botErr.message, null); return }
    const bot = botArr?.[0]
    if (!bot) { await log('bot_not_found', `phone_number_id=${phoneNumberId}`, null); return }
    if (bot.tenants?.status !== 'active') { await log('tenant_inactive', bot.tenants?.status, null); return }

    await log('bot_found', null, { bot_id: bot.id, tenant: bot.tenant_id })

    const tenantId = bot.tenant_id
    const month    = new Date().toISOString().slice(0,7)

    // 2. Incrementa uso
    await client.rpc('increment_usage', { p_tenant_id: tenantId, p_month: month }).catch(e => log('increment_err', e.message))

    // 3. markRead
    await markRead(bot.phone_number_id, bot.access_token, wamId).catch(() => {})

    // 4. Upsert contato
    const contactName = change?.contacts?.[0]?.profile?.name || ''
    const { data: contact, error: contactErr } = await client
      .from('contacts')
      .upsert(
        { tenant_id: tenantId, phone: from, name: contactName || undefined, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,phone' }
      )
      .select().single()

    if (contactErr) { await log('contact_error', contactErr.message, null); return }
    await log('contact_ok', null, { contact_id: contact.id })

    // 5. Conversa
    let { data: conv } = await client
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId).eq('bot_id', bot.id).eq('contact_id', contact.id)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conv) {
      const { data: newConv, error: convErr } = await client
        .from('conversations')
        .insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' })
        .select().single()
      if (convErr) { await log('conv_error', convErr.message, null); return }
      conv = newConv
    }
    await log('conv_ok', null, { conv_id: conv.id })

    // 6. Mensagem inbound
    await client.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
      contact_id: contact.id, direction: 'inbound', type: msg.type,
      content: userText || `[${msg.type}]`, meta_message_id: wamId
    }).then(({ error: e }) => { if (e) log('msg_inbound_err', e.message) })

    // 7. Human takeover
    if (conv.status === 'human') { await log('human_mode', null, null); return }

    if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
      await client.from('conversations').update({ status: 'human' }).eq('id', conv.id)
      const reply = '👤 Transferindo para um atendente.'
      await sendText(bot.phone_number_id, bot.access_token, from, reply).catch(e => log('send_err', e.message))
      return
    }

    // 8. Flow
    const { reply, node } = await processMessage(bot, conv, userText, {
      supabase: client,
      sendFn: async (text) => sendText(bot.phone_number_id, bot.access_token, from, text)
    })

    await log('flow_ok', null, { reply: reply?.substring(0,100) })

    // 9. Envio
    if (node?.type === 'menu' && node.options?.length && node.options.length <= 3) {
      await sendButtons(bot.phone_number_id, bot.access_token, from, reply,
        node.options.slice(0,3).map((o,i) => ({ id: o.id || `opt_${i}`, title: o.label?.substring(0,20) || `Opção ${i+1}` })))
        .catch(e => log('send_buttons_err', e.message))
    } else {
      await sendText(bot.phone_number_id, bot.access_token, from, reply)
        .catch(e => log('send_text_err', e.response?.data ? JSON.stringify(e.response.data) : e.message))
    }

    // 10. Outbound + atualiza conversa
    await client.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
      contact_id: contact.id, direction: 'outbound', content: reply
    })
    await client.from('conversations').update({
      last_message: reply, last_message_at: new Date().toISOString(), current_node_id: node?.id || null
    }).eq('id', conv.id)

    await log('done', null, { from, reply: reply?.substring(0,50) })

  } catch(err) {
    await log('fatal', err?.message + ' | ' + err?.stack?.substring(0,300), null)
  }
}
