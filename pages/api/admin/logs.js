/**
 * GET /api/admin/logs
 * Lista os webhook_logs mais recentes da plataforma, pra monitoramento
 * e diagnóstico de problemas. Só a equipe Arkiel (is_platform_admin).
 * Query params: ?limit=200
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const limit = Math.min(parseInt(req.query.limit) || 200, 500)

  const { data: logs, error } = await db.from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ logs: logs || [] })
}
