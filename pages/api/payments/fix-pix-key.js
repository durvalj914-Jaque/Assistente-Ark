import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  
  // Fix PIX keys that are phone numbers without +55
  const { data: tenants } = await db.from('tenants').select('id, name, pix_key').not('pix_key', 'is', null)
  
  const fixes = []
  for (const t of tenants || []) {
    const key = t.pix_key
    // If it's only digits and doesn't start with +, add +55
    if (key && /^\d+$/.test(key) && !key.startsWith('+')) {
      const fixedKey = '+55' + key
      await db.from('tenants').update({ pix_key: fixedKey }).eq('id', t.id)
      fixes.push({ tenant: t.name, old: key, new: fixedKey })
    }
  }
  
  return res.status(200).json({ fixes })
}
