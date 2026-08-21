/**
 * GET /api/billing/status?tenantId=xxx
 * Retorna o plano e status de billing do tenant
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { tenantId } = req.query
  if (!tenantId) return res.status(400).json({ error: 'tenantId é obrigatório' })

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')

  // Usar client normal para validar sessão (não service role)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Não autorizado' })

  // Usar admin para buscar dados do tenant
  const db = supabaseAdmin()

  const { data: tenant } = await db
    .from('tenants')
    .select('id,name,plan,status,plan_expires_at,billing_provider,max_bots,max_messages_month')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' })

  const { data: usage } = await db
    .from('usage')
    .select('messages,conversations,business_initiated_conversations,service_messages,total_messages')
    .eq('tenant_id', tenantId)
    .eq('month', new Date().toISOString().slice(0,7))
    .maybeSingle()

  return res.status(200).json({ tenant, usage: usage || { messages: 0, conversations: 0, business_initiated_conversations: 0, service_messages: 0, total_messages: 0 } })
}
