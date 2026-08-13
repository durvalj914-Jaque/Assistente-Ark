/**
 * GET  /api/admin/platform-config  — Lê config da plataforma
 * POST /api/admin/platform-config  — Salva config da plataforma
 *
 * Stores: fee_config, plan_resources, plans, and any other platform-level config
 * Uses: a dedicated JSONB column or the mp_access_token JSON as fallback
 *
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  if (req.method === 'GET') {
    const { data: t } = await db.from('tenants')
      .select('mp_access_token, fee_config')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    let config = {}
    if (t?.mp_access_token) {
      try { config = JSON.parse(t.mp_access_token) } catch {}
    }
    if (t?.fee_config) {
      try {
        const fc = typeof t.fee_config === 'object' ? t.fee_config : JSON.parse(t.fee_config)
        if (fc) config.fee_config = { ...config.fee_config, ...fc }
      } catch {}
    }

    return res.status(200).json({ config })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
