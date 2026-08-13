/**
 * GET  /api/admin/fee-config  — Retorna a config de taxas da plataforma
 * POST /api/admin/fee-config  — Salva a config de taxas
 *
 * fee_config: {
 *   pix:        2.0,   // % taxa PIX
 *   credit_card: 3.0,   // % taxa cartão crédito
 *   debit_card: 2.5,   // % taxa cartão débito
 *   boleto:     2.0,   // % taxa boleto
 * }
 *
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  // Arkiel tenant ID (config global da plataforma)
  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  if (req.method === 'GET') {
    const { data: tenant } = await db.from('tenants')
      .select('fee_config')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()

    const feeConfig = tenant?.fee_config || { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }
    return res.status(200).json({ fee_config: feeConfig })

  } else if (req.method === 'POST') {
    const { fee_config } = req.body
    if (!fee_config || typeof fee_config !== 'object') {
      return res.status(400).json({ error: 'fee_config é obrigatório' })
    }

    // Validar valores (0 a 100)
    const validKeys = ['pix', 'credit_card', 'debit_card', 'boleto']
    const sanitized = {}
    for (const key of validKeys) {
      const val = parseFloat(fee_config[key])
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: `Taxa inválida para ${key}: ${fee_config[key]}` })
      }
      sanitized[key] = val
    }

    const { error } = await db.from('tenants')
      .update({ fee_config: sanitized })
      .eq('id', ARKIEL_TENANT_ID)

    if (error) {
      // A coluna pode não existir — tentar criar
      if (error.message.includes('fee_config') || error.code === 'PGRPG204' || error.code === '42P01') {
        // Fallback: salvar como metadados JSON em outro campo
        const { data: tenant } = await db.from('tenants').select('mp_access_token').eq('id', ARKIEL_TENANT_ID).maybeSingle()
        let existing = {}
        try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
        existing.fee_config = sanitized
        const { error: err2 } = await db.from('tenants')
          .update({ mp_access_token: JSON.stringify(existing) })
          .eq('id', ARKIEL_TENANT_ID)
        if (err2) return res.status(500).json({ error: err2.message })
        return res.status(200).json({ ok: true, fee_config: sanitized, stored_in: 'mp_access_token' })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true, fee_config: sanitized })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
