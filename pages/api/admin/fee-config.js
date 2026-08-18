/**
 * GET  /api/admin/fee-config  — Retorna a config de taxas da plataforma
 * POST /api/admin/fee-config  — Salva a config de taxas
 *
 * fee_config: {
 *   pix:           { fee_percent: 2.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   credit_card:   { fee_percent: 3.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   debit_card:    { fee_percent: 2.5, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   boleto:        { fee_percent: 2.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   bank_transfer: { fee_percent: 1.5, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   account_balance:{ fee_percent: 1.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   paypal:        { fee_percent: 3.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 *   prepaid_card:  { fee_percent: 2.5, fee_fixed: 0, fee_min: 0, fee_max: 0 },
 * }
 *
 * fee_percent: % da transação (0-100)
 * fee_fixed:   valor fixo em R$ por transação (0 = sem valor fixo)
 * fee_min:     valor mínimo da taxa em R$ (0 = sem mínimo)
 * fee_max:     valor máximo da taxa em R$ (0 = sem máximo)
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
  const DEFAULT_FEES = {
    pix:            { fee_percent: 2.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    credit_card:    { fee_percent: 3.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    debit_card:     { fee_percent: 2.5, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    boleto:         { fee_percent: 2.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    bank_transfer:  { fee_percent: 1.5, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    account_balance:{ fee_percent: 1.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    paypal:         { fee_percent: 3.0, fee_fixed: 0, fee_min: 0, fee_max: 0 },
    prepaid_card:   { fee_percent: 2.5, fee_fixed: 0, fee_min: 0, fee_max: 0 },
  }

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

  // Normaliza config antiga (só números) para o novo formato (objetos)
  function normalizeFees(raw) {
    const result = {}
    for (const key of Object.keys(DEFAULT_FEES)) {
      const val = raw?.[key]
      if (typeof val === 'number') {
        result[key] = { ...DEFAULT_FEES[key], fee_percent: val }
      } else if (val && typeof val === 'object') {
        result[key] = {
          fee_percent: parseFloat(val.fee_percent) || 0,
          fee_fixed: parseFloat(val.fee_fixed) || 0,
          fee_min: parseFloat(val.fee_min) || 0,
          fee_max: parseFloat(val.fee_max) || 0,
        }
      } else {
        result[key] = { ...DEFAULT_FEES[key] }
      }
    }
    return result
  }

  if (req.method === 'GET') {
    const json = await readJson()
    const fees = normalizeFees(json.fee_config)
    return res.status(200).json({ fee_config: fees })

  } else if (req.method === 'POST') {
    const { fee_config } = req.body
    if (!fee_config || typeof fee_config !== 'object') {
      return res.status(400).json({ error: 'fee_config é obrigatório' })
    }

    const validKeys = ['pix', 'credit_card', 'debit_card', 'boleto', 'bank_transfer', 'account_balance', 'paypal', 'prepaid_card']
    const sanitized = {}

    for (const key of validKeys) {
      const cfg = fee_config[key]
      if (!cfg || typeof cfg !== 'object') {
        return res.status(400).json({ error: `Config inválida para ${key}` })
      }

      const fee_percent = parseFloat(cfg.fee_percent)
      const fee_fixed = parseFloat(cfg.fee_fixed)
      const fee_min = parseFloat(cfg.fee_min)
      const fee_max = parseFloat(cfg.fee_max)

      if (isNaN(fee_percent) || fee_percent < 0 || fee_percent > 100) {
        return res.status(400).json({ error: `Percentual inválido para ${key} (0-100)` })
      }
      if (isNaN(fee_fixed) || fee_fixed < 0) {
        return res.status(400).json({ error: `Valor fixo inválido para ${key}` })
      }
      if (isNaN(fee_min) || fee_min < 0) {
        return res.status(400).json({ error: `Valor mínimo inválido para ${key}` })
      }
      if (isNaN(fee_max) || fee_max < 0) {
        return res.status(400).json({ error: `Valor máximo inválido para ${key}` })
      }

      sanitized[key] = { fee_percent, fee_fixed, fee_min, fee_max }
    }

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
