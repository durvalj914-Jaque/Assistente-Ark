/**
 * GET /api/contacts/list?tenant_id=xxx
 * Lista contatos de um tenant. Usa client autenticado do usuário.
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const userToken = authHeader.replace('Bearer ', '')

  const { tenant_id } = req.query
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const db = createClient(supaUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userToken}` } }
  })

  const { data: { user } } = await db.auth.getUser(userToken)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const { data, error, count } = await db
    .from('contacts')
    .select('id, full_name, email, phone, phone_e164, photo_url, organization, job_title, synced_at', { count: 'exact' })
    .eq('tenant_id', tenant_id)
    .order('full_name', { ascending: true })
    .limit(500)

  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      return res.status(200).json({ contacts: [], total: 0, needsInit: true })
    }
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ contacts: data || [], total: count || 0 })
}
