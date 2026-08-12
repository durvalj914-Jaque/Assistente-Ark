import { supabaseAdmin } from '../../../lib/supabase'
import { generatePixCode } from '../../../lib/pix'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  
  // Get all tenants
  const { data: tenants, error: terr } = await db.from('tenants').select('id, name, pix_key, merchant_name, merchant_city').limit(5)
  
  // Get all bots
  const { data: bots, error: berr } = await db.from('bots').select('id, name, tenant_id').limit(5)
  
  // For each tenant, generate a test PIX code
  const results = []
  for (const t of tenants || []) {
    const pixKey = t.pix_key
    const name = (t.merchant_name || t.name || 'Arkiel').substring(0, 25)
    const city = (t.merchant_city || 'SAO PAULO').substring(0, 15)
    
    let pixCode = null
    if (pixKey) {
      pixCode = generatePixCode({ pixKey, merchantName: name, merchantCity: city, amount: 1.00, txid: 'ARKDIAG001', description: 'Teste' })
    }
    
    results.push({ tenant_id: t.id, tenant_name: t.name, pix_key: pixKey, merchant_name: name, merchant_city: city, pixCode })
  }
  
  return res.status(200).json({ tenants: results, tenant_error: terr?.message, bot_error: berr?.message })
}
