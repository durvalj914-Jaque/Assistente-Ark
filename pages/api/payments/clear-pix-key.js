import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  const tenantId = req.query.tenant_id || 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  
  const { data, error } = await db.from('tenants')
    .update({ pix_key: null, merchant_name: null, merchant_city: null })
    .eq('id', tenantId)
    .select('id, name, pix_key')
  
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true, tenant: data })
}
