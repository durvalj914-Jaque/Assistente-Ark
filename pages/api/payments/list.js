/**
 * GET /api/payments/list
 * Lista pagamentos do tenant do usuário.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()

  let tenantId
  if (!profile?.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
    tenantId = member.tenant_id
  }

  let query = db.from('payments').select('*').order('created_at', { ascending: false }).limit(100)
  if (tenantId) query = query.eq('tenant_id', tenantId)

  const status = req.query.status
  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ payments: data || [] })
}
