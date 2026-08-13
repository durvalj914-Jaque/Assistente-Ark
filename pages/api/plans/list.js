/**
 * GET /api/plans/list
 * Lista planos ativos para o cliente assinar.
 * Também retorna a assinatura atual do tenant do cliente.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Resolver tenant do cliente
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Buscar planos do Arkiel
  const { data: arkielTenant } = await db.from('tenants')
    .select('mp_access_token')
    .eq('id', ARKIEL_TENANT_ID)
    .maybeSingle()

  let plans = []
  let resources = []
  try {
    const parsed = JSON.parse(arkielTenant?.mp_access_token || '{}')
    plans = parsed.plans || []
    resources = parsed.plan_resources || []
  } catch {}

  // Tentar tabela plans
  if (plans.length === 0) {
    const { data: dbPlans } = await db.from('plans').select('*').order('created_at', { ascending: true })
    if (dbPlans) plans = dbPlans
  }

  // Filtrar só ativos e enriquecer com recursos
  const activePlans = plans
    .filter(p => p.active !== false)
    .map(p => {
      const planResources = (p.resource_ids || []).map(rid => resources.find(r => r.id === rid)).filter(Boolean)
      return {
        ...p,
        resources: planResources,
        total_resources: planResources.length,
      }
    })

  // Buscar assinatura atual do cliente
  let currentSubscription = null
  if (member) {
    const { data: clientTenant } = await db.from('tenants')
      .select('subscription, plan, plan_expires_at, status')
      .eq('id', member.tenant_id)
      .maybeSingle()
    if (clientTenant?.subscription) {
      try { currentSubscription = JSON.parse(clientTenant.subscription) } catch {}
    }
    if (currentSubscription) {
      currentSubscription.plan = clientTenant.plan
      currentSubscription.expires_at = clientTenant.plan_expires_at
      currentSubscription.status = clientTenant.status
    }
  }

  return res.status(200).json({ plans: activePlans, current_subscription: currentSubscription })
}
