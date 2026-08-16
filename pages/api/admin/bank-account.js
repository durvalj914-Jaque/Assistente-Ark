/**
 * GET  /api/admin/bank-account  — Retorna os dados da conta bancária de recebimento
 * POST /api/admin/bank-account  — Salva/atualiza os dados da conta bancária
 *
 * Armazenado em: tenants.mp_access_token JSON (tenant Arkiel) como "bank_account"
 *
 * Campos:
 *   bank_code, bank_name, account_type, branch, branch_digit,
 *   account_number, account_digit, holder_name, holder_document,
 *   holder_type, pix_key
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
    const { data: t, error } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    if (error) { console.error('[bank-account] read error:', error.message); return {} }
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
    return res.status(200).json({ bank_account: json.bank_account || null })

  } else if (req.method === 'POST') {
    const { bank_account } = req.body
    if (!bank_account || typeof bank_account !== 'object') {
      return res.status(400).json({ error: 'bank_account é obrigatório' })
    }

    const required = ['holder_name', 'holder_document', 'bank_code', 'branch', 'account_number']
    for (const field of required) {
      if (!bank_account[field] || !String(bank_account[field]).trim()) {
        return res.status(400).json({ error: `Campo obrigatório: ${field}` })
      }
    }

    const sanitized = {
      bank_code: String(bank_account.bank_code).trim(),
      bank_name: String(bank_account.bank_name || '').trim(),
      account_type: bank_account.account_type === 'savings' ? 'savings' : 'checking',
      branch: String(bank_account.branch).trim(),
      branch_digit: String(bank_account.branch_digit || '').trim(),
      account_number: String(bank_account.account_number).trim(),
      account_digit: String(bank_account.account_digit || '').trim(),
      holder_name: String(bank_account.holder_name).trim(),
      holder_document: String(bank_account.holder_document).replace(/\D/g, ''),
      holder_type: String(bank_account.holder_document || '').replace(/\D/g, '').length > 11 ? 'company' : 'individual',
      pix_key: String(bank_account.pix_key || '').trim(),
    }

    const json = await readJson()
    json.bank_account = sanitized
    const ok = await saveJson(json)

    if (!ok) {
      return res.status(500).json({ error: 'Erro ao salvar no banco' })
    }

    return res.status(200).json({ ok: true, bank_account: sanitized })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
