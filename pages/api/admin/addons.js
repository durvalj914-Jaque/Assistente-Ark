/**
 * GET    /api/admin/addons  — Lista todos os pacotes/recursos avulsos
 * POST   /api/admin/addons  — Cria um novo pacote
 * PATCH  /api/admin/addons  — Atualiza um pacote (req.body.id)
 * DELETE /api/admin/addons  — Remove um pacote (req.body.id)
 *
 * Addon: { id, name, description, price, billing_type, category, quantity, active }
 *   billing_type: 'one_time' | 'monthly'
 *   category: 'conversas' | 'bots' | 'features' | 'credits'
 *
 * Stored in: tenants.mp_access_token JSON (key: addons) — mesmo padrão do plans fallback
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  // Helper: ler addons do JSON do tenant Arkiel
  async function readAddons() {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    try {
      const parsed = JSON.parse(tenant?.mp_access_token || '{}')
      return parsed.addons || []
    } catch {
      return []
    }
  }

  // Helper: salvar addons
  async function saveAddons(addons) {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    let existing = {}
    try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
    existing.addons = addons

    const { error } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(existing) })
      .eq('id', ARKIEL_TENANT_ID)

    return !error
  }

  if (req.method === 'GET') {
    const addons = await readAddons()
    // Seed inicial se vazio
    if (addons.length === 0) {
      const seed = [
        { id: crypto.randomUUID(), name: 'Pacote 1.000 Conversas', description: 'Mil conversas iniciadas adicionais', price: 49.90, billing_type: 'one_time', category: 'conversas', quantity: 1000, active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Pacote 5.000 Conversas', description: 'Cinco mil conversas iniciadas adicionais', price: 199.00, billing_type: 'one_time', category: 'conversas', quantity: 5000, active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Bot Adicional', description: 'Um bot extra além do limite do plano', price: 29.90, billing_type: 'monthly', category: 'bots', quantity: 1, active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'IA Premium', description: 'Acesso ao modelo GPT-4 para respostas inteligentes', price: 39.90, billing_type: 'monthly', category: 'features', quantity: 1, active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Catálogo WhatsApp', description: 'Sincronização automática de catálogo no WhatsApp', price: 19.90, billing_type: 'monthly', category: 'features', quantity: 1, active: true, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), name: 'Webhook + API', description: 'Acesso à API e webhooks para integrações customizadas', price: 24.90, billing_type: 'monthly', category: 'features', quantity: 1, active: true, created_at: new Date().toISOString() },
      ]
      await saveAddons(seed)
      return res.status(200).json({ addons: seed })
    }
    return res.status(200).json({ addons })

  } else if (req.method === 'POST') {
    const { name, description, price, billing_type, category, quantity, active } = req.body
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' })

    const addons = await readAddons()
    const newAddon = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      price: parseFloat(price) || 0,
      billing_type: billing_type || 'one_time',
      category: category || 'conversas',
      quantity: parseInt(quantity) || 1,
      active: active !== false,
      created_at: new Date().toISOString(),
    }
    addons.push(newAddon)
    const ok = await saveAddons(addons)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar pacote' })
    return res.status(200).json({ ok: true, addon: newAddon })

  } else if (req.method === 'PATCH') {
    const { id, name, description, price, billing_type, category, quantity, active } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })

    const addons = await readAddons()
    const idx = addons.findIndex(a => a.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Pacote não encontrado' })

    if (name !== undefined) addons[idx].name = name
    if (description !== undefined) addons[idx].description = description
    if (price !== undefined) addons[idx].price = parseFloat(price)
    if (billing_type !== undefined) addons[idx].billing_type = billing_type
    if (category !== undefined) addons[idx].category = category
    if (quantity !== undefined) addons[idx].quantity = parseInt(quantity)
    if (active !== undefined) addons[idx].active = active

    const ok = await saveAddons(addons)
    if (!ok) return res.status(500).json({ error: 'Erro ao atualizar pacote' })
    return res.status(200).json({ ok: true })

  } else if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })

    const addons = await readAddons()
    const filtered = addons.filter(a => a.id !== id)
    const ok = await saveAddons(filtered)
    if (!ok) return res.status(500).json({ error: 'Erro ao remover pacote' })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
