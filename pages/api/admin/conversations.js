/**
 * GET /api/admin/conversations
 * Lista conversas de TODOS os tenants, pra visão global da plataforma.
 * Só a equipe Arkiel (is_platform_admin).
 * Query params: ?limit=100&status=human
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const limit = Math.min(parseInt(req.query.limit) || 100, 500)
  const status = req.query.status

  let query = db.from('conversations')
    .select('*, contacts(name, phone), bots(name), tenants(name)')
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data: conversations, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ conversations: conversations || [] })
}
