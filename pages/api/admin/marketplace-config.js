/**
 * /api/admin/marketplace-config
 * 
 * GET  — Retorna a config do marketplace (collector account, split status)
 * POST — Salva a config do marketplace
 *   { collector_id: 'xxx', collector_email: 'xxx', split_enabled: true }
 *
 * A config é armazenada no JSON do mp_access_token do tenant Arkiel,
 * junto com fee_config e planos.
 *
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  async function readJson() {
    const { data: t } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    try { return JSON.parse(t?.mp_access_token || '{}') } catch { return {} }
  }

  async function saveJson(json) {
    const { error } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(json) })
      .eq('id', ARKIEL_TENANT_ID)
    return !error
  }

  if (req.method === 'GET') {
    const json = await readJson()
    const config = json.marketplace_config || {
      collector_id: '',
      collector_email: '',
      split_enabled: false,
      split_mode: 'manual' // 'manual' = marketplace_fee na API, 'auto' = split via MP marketplace
    }
    return res.status(200).json({ marketplace_config: config })
  }

  if (req.method === 'POST') {
    const { collector_id, collector_email, split_enabled, split_mode } = req.body
    const json = await readJson()
    json.marketplace_config = {
      collector_id: collector_id || '',
      collector_email: collector_email || '',
      split_enabled: !!split_enabled,
      split_mode: split_mode || 'manual'
    }
    const ok = await saveJson(json)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true, marketplace_config: json.marketplace_config })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
