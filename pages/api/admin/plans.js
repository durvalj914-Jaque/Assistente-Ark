/**
 * GET    /api/admin/plans         — Lista todos os planos
 * POST   /api/admin/plans         — Cria um novo plano
 * PATCH  /api/admin/plans         — Atualiza um plano (req.body.id)
 * DELETE /api/admin/plans         — Remove um plano (req.body.id)
 *
 * Plano: { id, name, price, billing_cycle, duration_days, description, features[], active, created_at }
 *   billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'lifetime' | 'custom'
 *   duration_days: null (para monthly/yearly etc) ou número de dias (custom/lifetime=0)
 *
 * Stored in: Supabase table 'plans' (ou fallback em tenants JSON)
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  // Helper: ler planos do tenant Arkiel
  async function readPlans() {
    // Tentar tabela plans primeiro
    try {
      const { data, error } = await db.from('plans').select('*').order('created_at', { ascending: true })
      if (!error && data) return data
    } catch {}

    // Fallback: ler do JSON do tenant
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    try {
      const parsed = JSON.parse(tenant?.mp_access_token || '{}')
      return parsed.plans || []
    } catch {
      return []
    }
  }

  // Helper: salvar planos no tenant Arkiel (fallback)
  async function savePlansFallback(plans) {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    let existing = {}
    try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
    existing.plans = plans

    const { error } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(existing) })
      .eq('id', ARKIEL_TENANT_ID)

    return !error
  }

  if (req.method === 'GET') {
    const plans = await readPlans()
    return res.status(200).json({ plans })

  } else if (req.method === 'POST') {
    const { name, price, billing_cycle, duration_days, description, features, active, resource_ids } = req.body
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' })

    const plans = await readPlans()
    const newPlan = {
      id: crypto.randomUUID(),
      name,
      price: parseFloat(price) || 0,
      billing_cycle: billing_cycle || 'monthly',
      duration_days: duration_days ? parseInt(duration_days) : null,
      description: description || '',
      features: features || [],
      resource_ids: resource_ids || [],
      active: active !== false,
      created_at: new Date().toISOString(),
    }

    plans.push(newPlan)

    // Tentar tabela plans primeiro
    try {
      const { error } = await db.from('plans').insert({
        id: newPlan.id,
        name: newPlan.name,
        price: newPlan.price,
        billing_cycle: newPlan.billing_cycle,
        duration_days: newPlan.duration_days,
        description: newPlan.description,
        features: newPlan.features,
        resource_ids: newPlan.resource_ids,
        active: newPlan.active,
      })
      if (!error) return res.status(200).json({ ok: true, plan: newPlan })
    } catch {}

    // Fallback
    const ok = await savePlansFallback(plans)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar plano' })
    return res.status(200).json({ ok: true, plan: newPlan })

  } else if (req.method === 'PATCH') {
    const { id, name, price, billing_cycle, duration_days, description, features, active, resource_ids } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })

    const updates = {}
    if (name !== undefined) updates.name = name
    if (price !== undefined) updates.price = parseFloat(price)
    if (billing_cycle !== undefined) updates.billing_cycle = billing_cycle
    if (duration_days !== undefined) updates.duration_days = duration_days ? parseInt(duration_days) : null
    if (description !== undefined) updates.description = description
    if (features !== undefined) updates.features = features
    if (active !== undefined) updates.active = active
    if (resource_ids !== undefined) updates.resource_ids = resource_ids

    // Tentar tabela plans
    try {
      const { error } = await db.from('plans').update(updates).eq('id', id)
      if (!error) return res.status(200).json({ ok: true })
    } catch {}

    // Fallback
    const plans = await readPlans()
    const idx = plans.findIndex(p => p.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Plano não encontrado' })
    plans[idx] = { ...plans[idx], ...updates }
    const ok = await savePlansFallback(plans)
    if (!ok) return res.status(500).json({ error: 'Erro ao atualizar plano' })
    return res.status(200).json({ ok: true })

  } else if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })

    // Tentar tabela plans
    try {
      const { error } = await db.from('plans').delete().eq('id', id)
      if (!error) return res.status(200).json({ ok: true })
    } catch {}

    // Fallback
    const plans = await readPlans()
    const filtered = plans.filter(p => p.id !== id)
    const ok = await savePlansFallback(filtered)
    if (!ok) return res.status(500).json({ error: 'Erro ao remover plano' })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
