/**
 * GET /api/v1/conversations/{id}/messages
 * Mensagens de uma conversa do tenant autenticado por API key (ark_live_...).
 * Header: Authorization: Bearer <api_key>  (ou x-api-key)
 * Query opcional: after=<ISO date> (retorna só mensagens depois desse horário)
 * Retorna: { messages: [{ id, direction, type, content, created_at, sent_by }] }
 */
import { createClient } from '@supabase/supabase-js'
import { withCors } from '../../../../lib/v1Cors'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'missing_conversation_id' })

  const auth = req.headers.authorization || ''
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-api-key']
  if (!apiKey) return res.status(401).json({ error: 'missing_api_key' })

  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  const { data: tenant } = await db.from('tenants').select('id, status').eq('api_key', apiKey).maybeSingle()
  if (!tenant) return res.status(401).json({ error: 'invalid_api_key' })
  if (tenant.status !== 'active') return res.status(403).json({ error: 'tenant_inactive' })

  // Garante que a conversa pertence ao tenant da chave
  const { data: conv } = await db
    .from('conversations')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!conv) return res.status(404).json({ error: 'conversation_not_found' })

  let query = db
    .from('messages')
    .select('id, direction, type, content, created_at, sent_by')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  const after = req.query.after
  if (after) {
    const afterDate = new Date(after)
    if (!isNaN(afterDate.getTime())) query = query.gt('created_at', afterDate.toISOString())
  }

  const { data: messages, error } = await query
  if (error) return res.status(500).json({ error: 'db_error', detail: error.message })

  return res.status(200).json({ messages: messages || [] })
}

export default withCors(handler)
