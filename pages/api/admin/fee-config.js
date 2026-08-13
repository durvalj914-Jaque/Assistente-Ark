/**
 * GET  /api/admin/fee-config  — Retorna a config de taxas da plataforma
 * POST /api/admin/fee-config  — Salva a config de taxas
 *
 * fee_config: { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }
 *
 * Storage strategy (in order of preference):
 * 1. Column fee_config (JSONB) — se existir
 * 2. Inside mp_access_token JSON — fallback
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

  async function readTenant() {
    const { data, error } = await db.from('tenants')
      .select('fee_config, mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    return { data, error }
  }

  async function readFeeConfig() {
    const { data: t, error } = await readTenant()
    if (error || !t) return { fees: DEFAULT_FEES, storage: 'default' }

    // Priority 1: fee_config column
    if (t.fee_config) {
      try {
        const parsed = typeof t.fee_config === 'object' ? t.fee_config : JSON.parse(t.fee_config)
        if (parsed && Object.keys(parsed).length) {
          return { fees: { ...DEFAULT_FEES, ...parsed }, storage: 'fee_config_column' }
        }
      } catch {}
    }

    // Priority 2: inside mp_access_token JSON
    if (t.mp_access_token) {
      try {
        const mp = JSON.parse(t.mp_access_token)
        if (mp.fee_config && Object.keys(mp.fee_config).length) {
          return { fees: { ...DEFAULT_FEES, ...mp.fee_config }, storage: 'mp_access_token_json' }
        }
      } catch {}
    }

    return { fees: DEFAULT_FEES, storage: 'default' }
  }

  async function saveFeeConfig(fees) {
    // Strategy 1: try fee_config column
    const { error: colErr } = await db.from('tenants')
      .update({ fee_config: fees })
      .eq('id', ARKIEL_TENANT_ID)

    if (!colErr) {
      return { ok: true, stored_in: 'fee_config_column' }
    }

    console.log('[fee-config] fee_config column update failed, trying mp_access_token:', colErr.message)

    // Strategy 2: save inside mp_access_token JSON (preserving other keys)
    const { data: t, error: readErr } = await readTenant()
    if (readErr || !t) {
      return { ok: false, error: 'Não foi possível ler o tenant: ' + (readErr?.message || 'tenant not found') }
    }

    let existing = {}
    try { existing = JSON.parse(t.mp_access_token || '{}') } catch {}
    existing.fee_config = fees

    const { error: err2 } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(existing) })
      .eq('id', ARKIEL_TENANT_ID)

    if (err2) {
      return { ok: false, error: 'Erro ao salvar: ' + err2.message }
    }

    return { ok: true, stored_in: 'mp_access_token_json' }
  }

  if (req.method === 'GET') {
    const { fees, storage } = await readFeeConfig()
    return res.status(200).json({ fee_config: fees, storage })

  } else if (req.method === 'POST') {
    const { fee_config } = req.body
    if (!fee_config || typeof fee_config !== 'object') {
      return res.status(400).json({ error: 'fee_config é obrigatório' })
    }

    const validKeys = ['pix', 'credit_card', 'debit_card', 'boleto']
    const sanitized = {}
    for (const key of validKeys) {
      const val = parseFloat(fee_config[key])
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: `Taxa inválida para ${key}: ${fee_config[key]}` })
      }
      sanitized[key] = val
    }

    const result = await saveFeeConfig(sanitized)
    if (!result.ok) {
      return res.status(500).json({ error: result.error })
    }

    return res.status(200).json({ ok: true, fee_config: sanitized, stored_in: result.stored_in })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
