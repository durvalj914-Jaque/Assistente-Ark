/**
 * GET /api/billing/plans
 * Retorna planos e pacotes vendáveis para o B2B (qualquer tenant autenticado)
 * Lê da tabela 'plans' (criados no /painel > Planos) e do JSON de plan_resources
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  // Auth — qualquer usuário logado
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Não autorizado' })

  const db = supabaseAdmin()

  // ── 1. Planos da tabela 'plans' (criados no painel) ──
  let plans = []
  try {
    const { data, error } = await db.from('plans')
      .select('*')
      .eq('active', true)
      .order('price', { ascending: true })
    if (!error && data) plans = data
  } catch {}

  // ── 2. Recursos/Pacotes avulsos (plan_resources no JSON do tenant Arkiel) ──
  let resources = []
  try {
    const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    const parsed = JSON.parse(tenant?.mp_access_token || '{}')
    resources = parsed.plan_resources || []
  } catch {}

  // ── 3. Plano atual do tenant ──
  let currentPlan = null
  let usage = null
  try {
    const { data: tenantData } = await db.from('tenants')
      .select('plan, subscription')
      .eq('id', user.id)  // RLS garante que só vê o próprio tenant
      .maybeSingle()
    // Buscar via tenant_members
    if (!tenantData) {
      const { data: member } = await db.from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      if (member) {
        const { data: t } = await db.from('tenants')
          .select('plan, subscription')
          .eq('id', member.tenant_id)
          .maybeSingle()
        if (t) {
          currentPlan = t.plan || 'free'
          const sub = JSON.parse(t.subscription || '{}')
          if (sub?.status === 'active') currentPlan = sub.plan || currentPlan
        }
      }
    } else {
      currentPlan = tenantData.plan || 'free'
      const sub = JSON.parse(tenantData.subscription || '{}')
      if (sub?.status === 'active') currentPlan = sub.plan || currentPlan
    }

    // Buscar uso do mês
    const month = new Date().toISOString().slice(0, 7)
    // Usar service role para ler usage
    const { data: member } = await db.from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (member) {
      const { data: u } = await db.from('usage')
        .select('*')
        .eq('tenant_id', member.tenant_id)
        .eq('month', month)
        .maybeSingle()
      usage = u
    }
  } catch {}

  return res.status(200).json({
    plans,
    resources: resources.filter(r => r.active !== false),
    currentPlan,
    usage: usage ? {
      business_initiated_conversations: usage.business_initiated_conversations || 0,
      service_messages: usage.service_messages || 0,
      total_messages: usage.total_messages || 0,
      month: usage.month
    } : null
  })
}
