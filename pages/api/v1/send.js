import { createClient } from '@supabase/supabase-js'
import { sendText } from '../../../lib/meta'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const auth = req.headers.authorization || ''
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-api-key']
  if (!apiKey) return res.status(401).json({ error: 'missing_api_key' })

  const { to, message } = req.body || {}
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' })

  const db = getDB()

  const { data: tenant } = await db.from('tenants').select('id, status').eq('api_key', apiKey).maybeSingle()
  if (!tenant) return res.status(401).json({ error: 'invalid_api_key' })
  if (tenant.status !== 'active') return res.status(403).json({ error: 'tenant_inactive' })

  const { data: bot } = await db.from('bots').select('*').eq('tenant_id', tenant.id).eq('status', 'active').order('created_at').limit(1).maybeSingle()
  if (!bot || !bot.phone_number_id || !bot.access_token) return res.status(409).json({ error: 'no_active_bot_connected' })

  try {
    await sendText(bot.phone_number_id, bot.access_token, to, message)
  } catch (e) {
    return res.status(502).json({ error: 'whatsapp_send_failed', detail: e?.response?.data || e.message })
  }

  let contact
  const { data: existingContact } = await db.from('contacts').select('id').eq('tenant_id', tenant.id).eq('phone', to).maybeSingle()
  if (existingContact) {
    contact = existingContact
  } else {
    const { data: newContact } = await db.from('contacts').insert({ tenant_id: tenant.id, phone: to }).select('id').single()
    contact = newContact
  }

  let { data: conv } = await db.from('conversations').select('*').eq('tenant_id', tenant.id).eq('bot_id', bot.id).eq('contact_id', contact.id).neq('status', 'closed').order('last_message_at', { ascending: false }).limit(1).maybeSingle()
  if (!conv) {
    const { data: newConv } = await db.from('conversations').insert({ tenant_id: tenant.id, bot_id: bot.id, contact_id: contact.id, status: 'human' }).select('*').single()
    conv = newConv
  }

  await db.from('messages').insert({ tenant_id: tenant.id, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', type: 'text', content: message })
  await db.from('conversations').update({ last_message: message, last_message_at: new Date().toISOString() }).eq('id', conv.id)

  try { await db.rpc('increment_usage', { p_tenant_id: tenant.id, p_month: new Date().toISOString().slice(0, 7) }) } catch (_) {}

  return res.status(200).json({ ok: true })
}
