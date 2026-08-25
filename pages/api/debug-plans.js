import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  
  const { data, error } = await db.from('plans').select('*').order('price', { ascending: true })
  
  if (error) return res.status(500).json({ error: error.message })
  
  const summary = data.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    active: p.active,
    active_type: typeof p.active
  }))
  
  return res.status(200).json({ total: data.length, plans: summary })
}
