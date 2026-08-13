/**
 * GET    /api/admin/plan-resources  — Lista recursos disponíveis (catálogo)
 * POST   /api/admin/plan-resources  — Cria um recurso
 * PATCH  /api/admin/plan-resources  — Atualiza um recurso (req.body.id)
 * DELETE /api/admin/plan-resources  — Remove um recurso (req.body.id)
 *
 * Recurso: { id, name, price, description, category }
 * Stored in: tenants JSON (Arkiel) as plan_resources[]
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  async function readData() {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    try {
      const parsed = JSON.parse(tenant?.mp_access_token || '{}')
      return parsed
    } catch { return {} }
  }

  async function saveData(data) {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    let existing = {}
    try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
    existing.plan_resources = data
    const { error } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(existing) })
      .eq('id', ARKIEL_TENANT_ID)
    return !error
  }

  if (req.method === 'GET') {
    const data = await readData()
    return res.status(200).json({ resources: data.plan_resources || [] })

  } else if (req.method === 'POST') {
    const { name, price, description, category } = req.body
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' })
    const data = await readData()
    const resources = data.plan_resources || []
    const newRes = {
      id: crypto.randomUUID(),
      name,
      price: parseFloat(price) || 0,
      description: description || '',
      category: category || 'geral',
    }
    resources.push(newRes)
    const ok = await saveData(resources)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true, resource: newRes })

  } else if (req.method === 'PATCH') {
    const { id, name, price, description, category } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })
    const data = await readData()
    const resources = data.plan_resources || []
    const idx = resources.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Recurso não encontrado' })
    if (name !== undefined) resources[idx].name = name
    if (price !== undefined) resources[idx].price = parseFloat(price)
    if (description !== undefined) resources[idx].description = description
    if (category !== undefined) resources[idx].category = category
    const ok = await saveData(resources)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true })

  } else if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })
    const data = await readData()
    const resources = (data.plan_resources || []).filter(r => r.id !== id)
    const ok = await saveData(resources)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
