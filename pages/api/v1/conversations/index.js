/**
 * GET /api/v1/conversations
 * Lista as conversas do tenant autenticado por API key (ark_live_...).
 * Header: Authorization: Bearer <api_key>  (ou x-api-key)
 * Retorna: { conversations: [{ id, contact, last_message, last_message_at, mode, status }] }
 */
import { createClient } from '@supabase/supabase-js'
import { withCors } from '../../../lib/v1Cors'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const auth = req.headers.authorization || ''
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-api-key']
  if (!apiKey) return res.status(401).json({ error: 'missing_api_key' })

  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  const { data: tenant } = await db.from('tenants').select('id, status').eq('api_key', apiKey).maybeSingle()
  if (!tenant) return res.status(401).json({ error: 'invalid_api_key' })
  if (tenant.status !== 'active') return res.status(403).json({ error: 'tenant_inactive' })

  const { data: conversations, error } = await db
    .from('conversations')
    .select(`
      id, status, last_message, last_message_at, created_at,
      contact:contacts ( id, name, phone )
    `)
    .eq('tenant_id', tenant.id)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)

  if (error) return res.status(500).json({ error: 'db_error', detail: error.message })

  const list = (conversations || []).map((c) => ({
    id: c.id,
    contact: c.contact
      ? { name: c.contact.name || c.contact.phone || 'Contato', phone: c.contact.phone }
      : null,
    last_message: c.last_message,
    last_message_at: c.last_message_at || c.created_at,
    mode: c.status === 'human' ? 'human' : 'auto',
    status: c.status,
  }))

  return res.status(200).json({ conversations: list })
}

export default withCors(handler)
