/**
 * GET /api/contacts/list?tenant_id=xxx
 * Lista contatos de um tenant. Requer platform admin.
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const { tenant_id } = req.query
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

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
