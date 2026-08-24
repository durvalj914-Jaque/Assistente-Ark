import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const db = createClient(url, key, { auth: { persistSession: false } })
  
  // Simular exatamente o que /api/billing/plans faz
  const { data, error } = await db.from('plans')
    .select('*')
    .eq('active', true)
    .order('price', { ascending: true })
  
  if (error) return res.status(500).json({ error: error.message, details: error })
  
  return res.status(200).json({
    total: data.length,
    planNames: data.map(p => ({ name: p.name, price: p.price, active: p.active })),
    // Simular o que billing/plans retorna
    plans: data
  })
}
