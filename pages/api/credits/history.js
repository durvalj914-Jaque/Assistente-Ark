import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  
  const { tenant_id, limit } = req.query
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' })
  
  const db = getDB()
  const { data, error } = await db.from('credit_usage_log')
    .select('id, credit_type, conversation_id, origin_type, cost_brl, contact_phone, created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit) || 50)
  
  if (error) return res.status(500).json({ error: error.message })
  
  return res.status(200).json({ usage: data || [] })
}
