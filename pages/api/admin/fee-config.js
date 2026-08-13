/**
 * GET  /api/admin/fee-config  — Retorna a config de taxas da plataforma
 * POST /api/admin/fee-config  — Salva a config de taxas
 *
 * fee_config: { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }
 *
 * Stored in: tenants.mp_access_token JSON (Arkiel tenant) as fee_config key
 * This is the same JSON that stores plans and plan_resources — all endpoints
 * read-modify-write preserving other keys.
 *
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  const DEFAULT_FEES = { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }

  // Read-modify-write helper (same pattern as plans.js and plan-resources.js)
  async function readJson() {
    const { data: t, error } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    if (error) { console.error('[fee-config] read error:', error.message); return {} }
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
    const fees = json.fee_config || DEFAULT_FEES
    return res.status(200).json({ fee_config: { ...DEFAULT_FEES, ...fees } })

  } else if (req.method === 'POST') {
    const { fee_config } = req.body
    if (!fee_config || typeof fee_config !== 'object') {
      return res.status(400).json({ error: 'fee_config é obrigatório' })
    }

    // Validate and sanitize
    const validKeys = ['pix', 'credit_card', 'debit_card', 'boleto']
    const sanitized = {}
    for (const key of validKeys) {
      const val = parseFloat(fee_config[key])
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: `Taxa inválida para ${key}: valor "${fee_config[key]}" não é um número válido (0-100)` })
      }
      sanitized[key] = val
    }

    // Read-modify-write (preserves plans, plan_resources, etc.)
    const json = await readJson()
    json.fee_config = sanitized
    const ok = await saveJson(json)

    if (!ok) {
      return res.status(500).json({ error: 'Erro ao salvar no banco' })
    }

    return res.status(200).json({ ok: true, fee_config: sanitized })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
