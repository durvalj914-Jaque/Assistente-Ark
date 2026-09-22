/**
 * POST /api/v1/toggle-mode
 * Alterna uma conversa entre modo bot e humano, autenticado por API key (ark_live_...).
 * Body: { conversation_id, mode }  -> mode: 'auto' | 'human'
 * Header: Authorization: Bearer <api_key>  (ou x-api-key)
 * Retorna: { ok: true, mode }
 */
import { createClient } from '@supabase/supabase-js'
import { withCors } from '../../lib/v1Cors'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { conversation_id, mode } = req.body || {}
  if (!conversation_id || !['auto', 'human'].includes(mode)) {
    return res.status(400).json({ error: 'conversation_id e mode (auto|human) são obrigatórios' })
  }

  const auth = req.headers.authorization || ''
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-api-key']
  if (!apiKey) return res.status(401).json({ error: 'missing_api_key' })

  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  const { data: tenant } = await db.from('tenants').select('id, status').eq('api_key', apiKey).maybeSingle()
  if (!tenant) return res.status(401).json({ error: 'invalid_api_key' })
  if (tenant.status !== 'active') return res.status(403).json({ error: 'tenant_inactive' })

  const { data: conv } = await db
    .from('conversations')
    .select('id, status')
    .eq('id', conversation_id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!conv) return res.status(404).json({ error: 'conversation_not_found' })
  if (conv.status === 'closed') return res.status(400).json({ error: 'conversation_closed' })

  const update = { status: mode === 'human' ? 'human' : 'bot' }
  // Ao devolver para o bot, reinicia o fluxo a partir do menu principal (mesma regra do painel).
  if (mode === 'auto') update.current_node_id = null

  const { error } = await db.from('conversations').update(update).eq('id', conversation_id)
  if (error) return res.status(500).json({ error: 'db_error', detail: error.message })

  return res.status(200).json({ ok: true, mode })
}

export default withCors(handler)
