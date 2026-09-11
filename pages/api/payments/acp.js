/**
 * GET /api/payments/acp — Estado do ACP (Acumulador Cíclico Progressivo) do tenant logado.
 *
 * Retorna:
 *   cycle        — config (threshold, comissão por ciclo) + acumulador em tempo real
 *                  (fragmento atual, ciclos fechados, total repassado à Arkiel)
 *   cycle_length — tamanho do ciclo completo (threshold + comissão, ex: R$10,50)
 *   events       — últimos 20 eventos de entrada processados no acumulador
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'
import { getCommissionConfig } from '../../../lib/commissionEngine'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  const { data: member } = await db.from('tenant_members')
    .select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member?.tenant_id) return res.status(403).json({ error: 'Sem tenant vinculado' })
  const tenantId = member.tenant_id

  const cycle = await getCommissionConfig(db, tenantId)

  // Override pelo plano ativo (mesma lógica do motor)
  let threshold = cycle.cycle_threshold
  let commission = cycle.commission_amount
  try {
    const { data: tenant } = await db.from('tenants').select('subscription').eq('id', tenantId).maybeSingle()
    if (tenant?.subscription) {
      const sub = JSON.parse(tenant.subscription)
      if (sub?.limits?.commission_cycle_threshold) threshold = Number(sub.limits.commission_cycle_threshold)
      if (sub?.limits?.commission_amount) commission = Number(sub.limits.commission_amount)
    }
  } catch {}

  const cycleLength = Number((threshold + commission).toFixed(2))

  const { data: events } = await db.from('commission_events')
    .select('created_at, gross_amount, net_amount, cycles_this_payment, commission_this_payment, fragmentation_carry')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20)

  return res.status(200).json({
    cycle: {
      ...cycle,
      cycle_threshold: threshold,
      commission_amount: commission,
    },
    cycle_length: cycleLength,
    effective_rate: cycleLength > 0 ? Number(((commission / cycleLength) * 100).toFixed(4)) : 0,
    events: events || [],
  })
}
