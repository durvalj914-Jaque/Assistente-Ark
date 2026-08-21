/**
 * /api/admin/commissions
 * 
 * GET  — Lista comissões por tenant (resumo + eventos)
 *   ?tenant_id=xxx  → filtra por tenant
 *   ?events=true    → retorna eventos individuais ao invés de resumo
 * 
 * PATCH — Atualiza config de ciclo de um tenant
 *   { tenant_id, cycle_threshold, commission_amount }
 * 
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'
import { supabaseAdmin } from '../../../lib/supabase'
import { getCommissionConfig } from '../../../lib/commissionEngine'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  if (req.method === 'GET') {
    const { tenant_id, events } = req.query

    if (events === 'true') {
      // Return individual commission events
      let query = db.from('commission_events').select('*').order('created_at', { ascending: false }).limit(100)
      if (tenant_id) query = query.eq('tenant_id', tenant_id)
      const { data, error } = await query
      if (error) return res.status(500).json({ error: error.message })

      // Enrich with tenant names
      const tenantIds = [...new Set(data.map(e => e.tenant_id))]
      const { data: tenants } = await db.from('tenants').select('id, name').in('id', tenantIds)
      const tenantMap = {}
      ;(tenants || []).forEach(t => { tenantMap[t.id] = t.name })

      return res.status(200).json({
        events: data.map(e => ({ ...e, tenant_name: tenantMap[e.tenant_id] || 'Desconhecido' }))
      })
    }

    // Return summary per tenant
    let query = db.from('commission_cycles').select('*').order('updated_at', { ascending: false })
    if (tenant_id) query = query.eq('tenant_id', tenant_id)
    const { data: cycles, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Enrich with tenant names
    const tenantIds = [...new Set((cycles || []).map(c => c.tenant_id))]
    const { data: tenants } = await db.from('tenants').select('id, name').in('id', tenantIds)
    const tenantMap = {}
    ;(tenants || []).forEach(t => { tenantMap[t.id] = t.name })

    // Aggregate totals
    const totals = (cycles || []).reduce((acc, c) => {
      acc.total_commission += Number(c.total_commission_earned || 0)
      acc.total_cycles += c.total_cycles_completed || 0
      acc.total_fragmentation += Number(c.accumulated_net || 0)
      return acc
    }, { total_commission: 0, total_cycles: 0, total_fragmentation: 0 })

    return res.status(200).json({
      cycles: (cycles || []).map(c => ({ ...c, tenant_name: tenantMap[c.tenant_id] || 'Desconhecido' })),
      totals: {
        total_commission_earned: Number(totals.total_commission.toFixed(2)),
        total_cycles_completed: totals.total_cycles,
        total_fragmentation: Number(totals.total_fragmentation.toFixed(2)),
      }
    })

  } else if (req.method === 'PATCH') {
    const { tenant_id, cycle_threshold, commission_amount } = req.body
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

    const updates = { updated_at: new Date().toISOString() }
    if (cycle_threshold !== undefined) updates.cycle_threshold = Number(cycle_threshold)
    if (commission_amount !== undefined) updates.commission_amount = Number(commission_amount)

    // Buscar ou criar
    let { data: cycle } = await db.from('commission_cycles')
      .select('id')
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (!cycle) {
      const { data: newCycle, error } = await db.from('commission_cycles').insert({
        tenant_id,
        cycle_threshold: Number(cycle_threshold) || 10.00,
        commission_amount: Number(commission_amount) || 0.50,
        accumulated_net: 0,
        total_cycles_completed: 0,
        total_commission_earned: 0,
      }).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, cycle: newCycle })
    }

    const { error } = await db.from('commission_cycles').update(updates).eq('id', cycle.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })

  }

  return res.status(405).json({ error: 'Method not allowed' })
}
