/**
 * GET /api/test/set-plan?action=free → set Arkiel tenant to "free" plan (TEMPORARY TEST)
 * GET /api/test/set-plan?action=restore → restore Arkiel tenant to "enterprise" plan
 */
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
  const action = req.query.action || 'free'
  
  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  
  if (action === 'free') {
    const { error } = await db.from('tenants').update({ plan: 'free', subscription: null }).eq('id', ARKIEL_TENANT_ID)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, plan: 'free', message: 'Arkiel set to FREE plan (temporary test)' })
  }
  
  if (action === 'restore') {
    const { error } = await db.from('tenants').update({ 
      plan: 'enterprise', 
      subscription: JSON.stringify({ status: 'active', plan: 'enterprise' }) 
    }).eq('id', ARKIEL_TENANT_ID)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, plan: 'enterprise', message: 'Arkiel restored to ENTERPRISE plan' })
  }
  
  return res.status(400).json({ error: 'Use ?action=free or ?action=restore' })
}
