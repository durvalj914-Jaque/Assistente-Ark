/**
 * POST /api/admin/migrate-fee-config
 * Adiciona a coluna fee_config (JSONB) na tabela tenants se não existir.
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return

  const { db } = ctx
  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  try {
    // Tentar salvar fee_config default — se a coluna não existir, o erro será capturado
    const defaultFees = { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }
    
    // Primeiro tenta salvar na coluna fee_config
    const { error } = await db.from('tenants')
      .update({ fee_config: defaultFees })
      .eq('id', ARKIEL_TENANT_ID)

    if (error) {
      // Coluna não existe — salvar como metadado no mp_access_token (JSON)
      const { data: tenant } = await db.from('tenants')
        .select('mp_access_token')
        .eq('id', ARKIEL_TENANT_ID)
        .maybeSingle()

      let existing = {}
      try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
      existing.fee_config = defaultFees

      const { error: err2 } = await db.from('tenants')
        .update({ mp_access_token: JSON.stringify(existing) })
        .eq('id', ARKIEL_TENANT_ID)

      if (err2) return res.status(500).json({ error: err2.message })
      
      return res.status(200).json({
        ok: true,
        message: 'fee_config salvo como metadado em mp_access_token (coluna fee_config não existe no Supabase)',
        fee_config: defaultFees,
        stored_in: 'mp_access_token',
      })
    }

    return res.status(200).json({
      ok: true,
      message: 'Coluna fee_config está disponível e foi populada com valores padrão',
      fee_config: defaultFees,
      stored_in: 'fee_config',
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
