import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: true } }

function getDB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

async function savelog(db, step, error, payload) {
  try {
    await db.from('webhook_logs').insert({ step, error: String(error || ''), payload: payload || null })
  } catch(e) {}
}

async function sendText(phoneId, token, to, text) {
  const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  })
  const data = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(data))
  return data
}

async function markRead(phoneId, token, messageId) {
  await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId })
  }).catch(() => {})
}

export default async function handler(req, res) {
  // GET — verificação Meta
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025')) {
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  if (req.method !== 'POST') return res.status(405).end()
  res.status(200).end()

  const db = getDB()

  try {
    const body   = req.body
    const change = body?.entry?.[0]?.changes?.[0]?.value

    await savelog(db, 'received', null, { object: body?.object, has_change: !!change })

    // Ignorar status updates
    if (change?.statuses?.length) {
      await savelog(db, 'status_update', 'ignored', null)
      return
    }

    const msgs = change?.messages
    if (!msgs?.length) {
      await savelog(db, 'no_messages', 'no messages array', { keys: Object.keys(change || {}) })
      return
    }

    const msg           = msgs[0]
    const fromRaw       = msg.from || ''
    // Normalizar número: 55 + DDD(2) + 9 + número(8) = 13 dígitos
    // Se vier sem o 9 (12 dígitos): adiciona o 9 após o DDD
    const from = (fromRaw.startsWith('55') && fromRaw.length === 12)
      ? fromRaw.slice(0, 4) + '9' + fromRaw.slice(4)
      : fromRaw

    const phoneNumberId = change?.metadata?.phone_number_id
    const wamId         = msg.id

    let userText = ''
    if (msg.type === 'text')             userText = msg.text?.body || ''
    else if (msg.type === 'button')      userText = msg.button?.text || msg.button?.payload || ''
    else if (msg.type === 'interactive') {
      const br = msg.interactive?.button_reply
      const lr = msg.interactive?.list_reply
      userText = br?.title || br?.id || lr?.title || lr?.id || ''
    }

    await savelog(db, 'parsed', null, { from, fromRaw, phoneNumberId, userText, type: msg.type })

    // 1. Buscar bot
    const { data: botArr, error: botErr } = await db
      .from('bots')
      .select('id,name,status,phone_number_id,tenant_id,access_token,greeting,fallback_message,human_takeover_keyword,flow,tenants(id,plan,status,max_messages_month)')
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .limit(1)

    if (botErr) { await savelog(db, 'bot_error', botErr.message, null); return }
    const bot = botArr?.[0]
    if (!bot) { await savelog(db, 'bot_not_found', `phoneNumberId=${phoneNumberId}`, null); return }
    if (bot.tenants?.status !== 'active') { await savelog(db, 'tenant_inactive', bot.tenants?.status, null); return }

    await savelog(db, 'bot_found', null, { bot_id: bot.id, bot_name: bot.name })

    const tenantId = bot.tenant_id
    const month    = new Date().toISOString().slice(0, 7)

    // 2. Incrementa uso
    await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: month }).catch(e => savelog(db, 'increment_err', e.message))

    // 3. Mark read
    await markRead(bot.phone_number_id, bot.access_token, wamId)

    // 4. Upsert contato
    const contactName = change?.contacts?.[0]?.profile?.name || ''
    const { data: contact, error: contactErr } = await db
      .from('contacts')
      .upsert(
        { tenant_id: tenantId, phone: from, name: contactName || undefined, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,phone' }
      )
      .select('id,phone,name')
      .single()

    if (contactErr) { await savelog(db, 'contact_error', contactErr.message, { from, tenantId }); return }
    await savelog(db, 'contact_ok', null, { contact_id: contact.id, phone: contact.phone })

    // 5. Busca ou cria conversa
    let { data: conv } = await db
      .from('conversations')
      .select('*')
      .eq('tenant_id', tenantId).eq('bot_id', bot.id).eq('contact_id', contact.id)
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conv) {
      const { data: newConv, error: convErr } = await db
        .from('conversations')
        .insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' })
        .select('*').single()
      if (convErr) { await savelog(db, 'conv_error', convErr.message, null); return }
      conv = newConv
    }
    await savelog(db, 'conv_ok', null, { conv_id: conv.id, status: conv.status })

    // 6. Salva inbound
    await db.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
      contact_id: contact.id, direction: 'inbound', type: msg.type,
      content: userText || `[${msg.type}]`, meta_message_id: wamId
    }).then(({ error: e }) => { if (e) savelog(db, 'msg_inbound_err', e.message) })

    // 7. Human takeover
    if (conv.status === 'human') { await savelog(db, 'human_mode', null, null); return }

    if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
      await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
      const reply = '👤 Transferindo para um atendente.'
      await sendText(bot.phone_number_id, bot.access_token, from, reply).catch(e => savelog(db, 'send_err', e.message))
      await db.from('messages').insert({ tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', content: reply })
      return
    }

    // 8. Processar fluxo
    const nodes = bot.flow?.nodes || []
    let reply = bot.greeting || 'Olá! Sou o assistente da Arkiel. Como posso ajudar?'
    let nodeId = null

    await savelog(db, 'flow_start', null, { nodes_count: nodes.length, current_node: conv.current_node_id })

    if (nodes.length > 0) {
      let currentNode
      if (!conv.current_node_id) {
        currentNode = nodes.find(n => !n.parentId) || nodes[0]
      } else {
        const cur = nodes.find(n => n.id === conv.current_node_id)
        if (cur?.type === 'menu') {
          const opt = cur.options?.find(o =>
            o.keyword?.toLowerCase() === userText?.toLowerCase() || o.id === userText
          )
          currentNode = opt?.nextId ? nodes.find(n => n.id === opt.nextId) : null
        } else {
          const firstChild = cur?.children?.[0]
          currentNode = firstChild ? nodes.find(n => n.id === firstChild) : null
        }
        if (!currentNode) {
          reply = bot.fallback_message || 'Não entendi. Pode repetir?'
          nodeId = conv.current_node_id
        }
      }
      if (currentNode) {
        reply = currentNode.text || reply
        nodeId = currentNode.id
      }
    }

    await savelog(db, 'flow_done', null, { reply: reply?.substring(0, 80), nodeId })

    // 9. Enviar resposta
    await sendText(bot.phone_number_id, bot.access_token, from, reply)
      .catch(e => savelog(db, 'send_text_err', typeof e === 'string' ? e : e?.message, null))

    // 10. Salva outbound + atualiza conversa
    await db.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
      contact_id: contact.id, direction: 'outbound', content: reply
    })
    await db.from('conversations').update({
      last_message: reply, last_message_at: new Date().toISOString(), current_node_id: nodeId
    }).eq('id', conv.id)

    await savelog(db, 'done', null, { to: from, reply: reply?.substring(0, 50) })

  } catch(err) {
    try {
      await db.from('webhook_logs').insert({ step: 'fatal', error: String(err?.message) + ' | ' + String(err?.stack).substring(0, 300), payload: null })
    } catch(e2) {}
  }
}
