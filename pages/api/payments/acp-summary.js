/**
 * GET /api/payments/acp-summary — Resumo do mês corrente do ACP do tenant logado.
 *
 * Alimenta o bloco "Seu mês real" da aba Upgrades: faturado, taxas, líquido
 * contado no ciclo, participação Ark, ciclos fechados e saldo acumulado.
 *
 * Retorna:
 *   month            — "YYYY-MM" corrente (fuso America/Sao_Paulo)
 *   month_gross      — bruto recebido via Ark no mês
 *   month_net        — líquido contado no acumulador (bruto - taxas de processamento)
 *   month_cycles     — ciclos fechados no mês
 *   month_commission — participação Ark no mês
 *   fees             — taxas de processamento (bruto - líquido)
 *   fragment         — saldo acumulado pra próximo ciclo (accumulated_net)
 *   cycle            — { cycle_threshold, commission_amount } vigentes no plano atual
 *   cycle_length     — threshold + comissão (ex: 10,50 / 20,50 / 30,50)
 *   effective_rate   — % efetiva por ciclo no plano atual
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

  // Override pelo plano ativo (mesma lógica do motor e do /api/payments/acp)
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

  // Mês corrente no fuso de São Paulo (UTC-3 fixo, sem horário de verão desde 2019)
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  const monthStartUtc = `${month}-01T03:00:00Z`

  const { data: events, error } = await db.from('commission_events')
    .select('gross_amount, net_amount, cycles_this_payment, commission_this_payment')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStartUtc)

  if (error) console.error('[acp-summary] query:', error.message)

  const sum = (events || []).reduce((acc, e) => ({
    gross: acc.gross + Number(e.gross_amount || 0),
    net: acc.net + Number(e.net_amount || 0),
    cycles: acc.cycles + Number(e.cycles_this_payment || 0),
    commission: acc.commission + Number(e.commission_this_payment || 0),
  }), { gross: 0, net: 0, cycles: 0, commission: 0 })

  return res.status(200).json({
    month,
    month_gross: Number(sum.gross.toFixed(2)),
    month_net: Number(sum.net.toFixed(2)),
    month_cycles: sum.cycles,
    month_commission: Number(sum.commission.toFixed(2)),
    fees: Number((sum.gross - sum.net).toFixed(2)),
    fragment: Number(Number(cycle.accumulated_net || 0).toFixed(2)),
    cycle: { cycle_threshold: threshold, commission_amount: commission },
    cycle_length: cycleLength,
    effective_rate: cycleLength > 0 ? Number(((commission / cycleLength) * 100).toFixed(4)) : 0,
  })
}
