/**
 * GET /api/admin/usage
 * Retorna uso agregado de todos os tenants no mês atual
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Não autorizado' })

  const db = supabaseAdmin()
  const month = new Date().toISOString().slice(0, 7)

  const { data, error } = await db
    .from('usage')
    .select('tenant_id, business_initiated_conversations, service_messages, total_messages')
    .eq('month', month)

  if (error) return res.status(500).json({ error: error.message })

  // Agregar
  const aggregated = (data || []).reduce((acc, row) => {
    acc.business_initiated_conversations += row.business_initiated_conversations || 0
    acc.service_messages += row.service_messages || 0
    acc.total_messages += row.total_messages || 0
    acc.tenants += 1
    return acc
  }, { business_initiated_conversations: 0, service_messages: 0, total_messages: 0, tenants: 0 })

  return res.status(200).json(aggregated)
}
