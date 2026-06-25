/**
 * GET /api/billing/status?tenantId=xxx
 * Retorna o plano e status de billing do tenant
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { tenantId } = req.query
  const authHeader   = req.headers.authorization || ''
  const userToken    = authHeader.replace('Bearer ', '')
  const db           = supabaseAdmin()

  const { data: { user } } = await db.auth.getUser(userToken)
  if (!user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: tenant } = await db
    .from('tenants')
    .select('id,name,plan,status,plan_expires_at,billing_provider,max_bots,max_messages_month')
    .eq('id', tenantId)
    .single()

  if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' })

  const { data: usage } = await db
    .from('usage')
    .select('messages,conversations')
    .eq('tenant_id', tenantId)
    .eq('month', new Date().toISOString().slice(0,7))
    .maybeSingle()

  return res.status(200).json({ tenant, usage: usage || { messages: 0, conversations: 0 } })
}
