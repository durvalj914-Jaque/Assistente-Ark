import { createClient } from '@supabase/supabase-js'
import { processFlow } from '../../../lib/flowEngine'

export const config = { api: { bodyParser: true } }

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PHONE_ID  = process.env.WHATSAPP_PHONE_ID || '1055720357624339'
const WA_TOKEN  = process.env.WHATSAPP_ACCESS_TOKEN
const VERIFY_TK = process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025'

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

async function savelog(db, step, error, payload) {
  try {
    await db.from('webhook_logs').insert({ step, error: error ? String(error) : '', payload: payload || null })
  } catch(_) {}
}

async function safeInsert(db, table, data) {
  try { await db.from(table).insert(data) } catch(_) {}
}

async function sendText(phoneId, token, to, text) {
  const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  })
  const data = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(data))
  return data
}

async function processWebhook(body) {
  const db     = getDB()
  const change = body?.entry?.[0]?.changes?.[0]?.value
  await savelog(db, 'received', null, { object: body?.object })

  if (change?.statuses?.length) { await savelog(db, 'status_update', 'ignored'); return }
  const msgs = change?.messages
  if (!msgs?.length) { await savelog(db, 'no_messages', 'empty'); return }

  const msg           = msgs[0]
  const fromRaw       = msg.from || ''
  const from          = (fromRaw.startsWith('55') && fromRaw.length === 12)
                        ? fromRaw.slice(0,4) + '9' + fromRaw.slice(4)
                        : fromRaw
  const phoneNumberId = change?.metadata?.phone_number_id || PHONE_ID
  const wamId         = msg.id

  let userText = ''
  if (msg.type === 'text')        userText = msg.text?.body?.trim() || ''
  else if (msg.type === 'button') userText = msg.button?.text || msg.button?.payload || ''
  else if (msg.type === 'interactive') {
    const br = msg.interactive?.button_reply
    const lr = msg.interactive?.list_reply
    userText = br?.title || br?.id || lr?.title || lr?.id || ''
  }
  await savelog(db, 'parsed', null, { from, phoneNumberId, userText })

  // Bot
  const { data: botArr, error: botErr } = await db
    .from('bots')
    .select('id,name,status,phone_number_id,tenant_id,access_token,greeting,fallback_message,human_takeover_keyword,flow,tenants(id,plan,status,max_messages_month)')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'active')
    .limit(1)

  if (botErr || !botArr?.length) { await savelog(db, 'bot_not_found', botErr?.message || 'empty'); return }
  const bot = botArr[0]
  if (bot.tenants?.status !== 'active') { await savelog(db, 'tenant_inactive', bot.tenants?.status); return }
  await savelog(db, 'bot_found', null, { bot_id: bot.id })

  const tenantId = bot.tenant_id
  const tkn      = bot.access_token || WA_TOKEN

  // Incrementar uso
  try {
    await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: new Date().toISOString().slice(0,7) })
  } catch(e) { await savelog(db, 'increment_err', e?.message) }

  // Mark read
  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tkn}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamId })
    })
  } catch(_) {}

  // Contato
  let contact
  const { data: existingContact } = await db
    .from('contacts').select('id,phone').eq('tenant_id', tenantId).eq('phone', from).maybeSingle()

  if (existingContact) {
    contact = existingContact
  } else {
    const contactName = change?.contacts?.[0]?.profile?.name || ''
    const { data: newContact, error: contactErr } = await db
      .from('contacts').insert({ tenant_id: tenantId, phone: from, name: contactName || null }).select('id,phone').single()
    if (contactErr) { await savelog(db, 'contact_error', contactErr.message); return }
    contact = newContact
  }

  // Conversa
  let { data: conv } = await db
    .from('conversations').select('*')
    .eq('tenant_id', tenantId).eq('bot_id', bot.id).eq('contact_id', contact.id)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false }).limit(1).maybeSingle()

  if (!conv) {
    const { data: newConv, error: convErr } = await db
      .from('conversations').insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' }).select('*').single()
    if (convErr) { await savelog(db, 'conv_error', convErr.message); return }
    conv = newConv
  }
  await savelog(db, 'conv_ok', null, { node: conv.current_node_id, status: conv.status })

  // Salvar inbound
  await safeInsert(db, 'messages', {
    tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
    contact_id: contact.id, direction: 'inbound', type: msg.type,
    content: userText || `[${msg.type}]`, meta_message_id: wamId
  })

  // Human mode
  if (conv.status === 'human') { await savelog(db, 'human_mode'); return }

  // Human takeover keyword (atalho direto, sem depender do fluxo)
  if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
    await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
    const reply = '👤 Transferindo para nossa equipe! Em breve um atendente entrará em contato. 😊'
    try { await sendText(phoneNumberId, tkn, from, reply) } catch(_) {}
    await safeInsert(db, 'messages', { tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', content: reply })
    await savelog(db, 'done_human')
    return
  }

  // ── Motor de fluxo unificado (lib/flowEngine.js) ──
  const nodes = bot.flow?.nodes || []
  const result = processFlow(nodes, conv.current_node_id, userText, { greeting: bot.greeting })
  await savelog(db, 'flow_result', null, { action: result.action, nodeId: result.nodeId, reply: result.reply?.substring(0,60) })

  let reply = result.reply || bot.fallback_message || 'Não entendi. Digite *0* para voltar ao menu.'
  let nodeId = result.nodeId
  let convUpdate = { last_message: reply, last_message_at: new Date().toISOString(), current_node_id: nodeId }

  if (result.action === 'transfer') {
    convUpdate.status = 'human'
  } else if (result.action === 'end') {
    convUpdate.status = 'closed'
  }

  // Enviar
  try {
    await sendText(phoneNumberId, tkn, from, reply)
    await savelog(db, 'send_ok', null, { to: from })
  } catch(e) {
    await savelog(db, 'send_err', e?.message)
  }

  await safeInsert(db, 'messages', {
    tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
    contact_id: contact.id, direction: 'outbound', content: reply
  })
  await db.from('conversations').update(convUpdate).eq('id', conv.id)
  await savelog(db, 'done', null, { nodeId, action: result.action })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token === VERIFY_TK) return res.status(200).send(challenge)
    return res.status(403).end()
  }
  if (req.method !== 'POST') return res.status(405).end()

  try {
    await processWebhook(req.body)
  } catch(err) {
    try {
      const db = getDB()
      await db.from('webhook_logs').insert({ step: 'fatal', error: String(err?.message) + ' | ' + String(err?.stack).substring(0,300) })
    } catch(_) {}
  }

  return res.status(200).json({ ok: true })
}
