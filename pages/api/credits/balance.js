import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const db = getDB()
  
  if (req.method === 'GET') {
    const { tenant_id } = req.query
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' })
    
    const { data, error } = await db.rpc('get_credit_balance', { p_tenant_id: tenant_id })
    if (error) return res.status(500).json({ error: error.message })
    
    return res.status(200).json(data)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}
