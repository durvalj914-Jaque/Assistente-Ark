import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const db = createClient(url, key, { auth: { persistSession: false } })
  
  const { data, error } = await db.from('plans').select('*').order('price', { ascending: true })
  
  if (error) return res.status(500).json({ error: error.message })
  
  return res.status(200).json({
    total: data.length,
    plans: data.map(p => ({
      id: p.id?.slice(0, 8),
      name: p.name,
      price: p.price,
      active: p.active,
      billing_cycle: p.billing_cycle,
      has_limits: !!p.limits,
      limit_keys: p.limits ? Object.keys(p.limits) : [],
      has_features: !!(p.features && p.features.length),
      features_count: p.features?.length || 0
    }))
  })
}
