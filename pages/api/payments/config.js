/**
 * GET  /api/payments/config  — Retorna a configuração de pagamento do tenant
 * POST /api/payments/config  — Salva a configuração
 *
 * Resolve o tenant da mesma forma que o hook useTenant:
 * ordena tenant_members por created_at ASC e pega o primeiro.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Resolver tenant da MESMA forma que o useTenant hook
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const tenantId = member?.tenant_id

  if (req.method === 'GET') {
    if (!tenantId) return res.status(200).json({ config: {} })
    const { data: tenant } = await db.from('tenants')
      .select('id, pix_key, merchant_name, merchant_city, mp_access_token')
      .eq('id', tenantId)
      .maybeSingle()

    // Buscar fee_config da plataforma (Arkiel tenant)
    const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
    const DEFAULT_FEES = { pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 }
    let fee_config = DEFAULT_FEES
    try {
      const { data: arkielTenant } = await db.from('tenants')
        .select('mp_access_token')
        .eq('id', ARKIEL_TENANT_ID)
        .maybeSingle()
      if (arkielTenant?.mp_access_token) {
        const parsed = JSON.parse(arkielTenant.mp_access_token)
        if (parsed.fee_config) fee_config = { ...DEFAULT_FEES, ...parsed.fee_config }
      }
    } catch (e) { console.error('[payments/config] fee_config error:', e.message) }

    return res.status(200).json({ config: { ...tenant, fee_config } })

  } else if (req.method === 'POST') {
    const { pix_key, merchant_name, merchant_city, mp_access_token } = req.body
    if (!tenantId) return res.status(400).json({ error: 'Tenant não encontrado' })

    const updates = {}
    if (pix_key !== undefined) updates.pix_key = pix_key
    if (merchant_name !== undefined) updates.merchant_name = merchant_name
    if (merchant_city !== undefined) updates.merchant_city = merchant_city
    if (mp_access_token !== undefined) updates.mp_access_token = mp_access_token

    const { error } = await db.from('tenants').update(updates).eq('id', tenantId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
