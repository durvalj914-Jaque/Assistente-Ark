/**
 * GET  /api/payments/config  — Retorna a configuração de pagamento do tenant
 * POST /api/payments/config  — Salva a configuração
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
  const tenantId = member?.tenant_id

  if (req.method === 'GET') {
    if (!tenantId) return res.status(200).json({ config: {} })
    const { data: tenant } = await db.from('tenants').select('id, pix_key, merchant_name, merchant_city, mp_access_token').eq('id', tenantId).maybeSingle()
    return res.status(200).json({ config: tenant || {} })

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
