/**
 * GET  /api/admin/fee-config  — Retorna a config de taxas da plataforma
 * POST /api/admin/fee-config  — Salva a config de taxas
 *
 * fee_config: {
 *   pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0
 * }
 *
 * Stored in: tenants.mp_access_token JSON (Arkiel tenant) as fee_config key
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  const DEFAULT_FEES = { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }

  // Helper: ler fee_config do tenant Arkiel
  async function readFeeConfig() {
    // Tentar coluna fee_config primeiro
    try {
      const { data: t1, error: e1 } = await db.from('tenants')
        .select('fee_config, mp_access_token')
        .eq('id', ARKIEL_TENANT_ID)
        .maybeSingle()

      if (t1) {
        // Prioridade 1: coluna fee_config
        if (t1.fee_config) {
          try {
            const parsed = typeof t1.fee_config === 'object' ? t1.fee_config : JSON.parse(t1.fee_config)
            if (parsed && Object.keys(parsed).length) return { ...DEFAULT_FEES, ...parsed }
          } catch {}
        }
        // Prioridade 2: dentro do JSON mp_access_token
        if (t1.mp_access_token) {
          try {
            const mp = JSON.parse(t1.mp_access_token)
            if (mp.fee_config) return { ...DEFAULT_FEES, ...mp.fee_config }
          } catch {}
        }
      }
    } catch (e) {
      console.error('[fee-config] read error:', e.message)
    }
    return DEFAULT_FEES
  }

  if (req.method === 'GET') {
    const feeConfig = await readFeeConfig()
    return res.status(200).json({ fee_config: feeConfig })

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
        return res.status(400).json({ error: `Taxa inválida para ${key}` })
      }
      sanitized[key] = val
    }

    // Tentar coluna fee_config primeiro
    const { error: colErr } = await db.from('tenants')
      .update({ fee_config: sanitized })
      .eq('id', ARKIEL_TENANT_ID)

    if (!colErr) {
      return res.status(200).json({ ok: true, fee_config: sanitized, stored_in: 'fee_config' })
    }

    // Fallback: salvar dentro do JSON mp_access_token
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    let existing = {}
    try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
    existing.fee_config = sanitized

    const { error: err2 } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(existing) })
      .eq('id', ARKIEL_TENANT_ID)

    if (err2) return res.status(500).json({ error: err2.message })
    return res.status(200).json({ ok: true, fee_config: sanitized, stored_in: 'mp_access_token' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
