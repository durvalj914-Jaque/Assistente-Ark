// POST /api/schedule/blocks        → cria bloqueio manual {tenant_id, date, start_time, end_time, reason}
// GET  /api/schedule/blocks?tenant_id= → lista bloqueios futuros (hoje pra frente)
// DELETE /api/schedule/blocks?tenant_id=&id= → remove bloqueio
import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant } from '../../../lib/serverAuth'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  const auth = await requireTenant(req, res)
  if (!auth) return
  const tenantId = auth.tenant_id

  if (req.method === 'GET') {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await db.from('schedule_blocks')
      .select('*').eq('tenant_id', tenantId).gte('date', today)
      .order('date').order('start_time')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ blocks: data || [] })
  }

  if (req.method === 'POST') {
    const { date, start_time, end_time, reason } = req.body || {}
    if (!date || !start_time || !end_time) {
      return res.status(400).json({ error: 'date, start_time e end_time são obrigatórios' })
    }
    const { data, error } = await db.from('schedule_blocks')
      .insert({ tenant_id: tenantId, date, start_time, end_time, reason: reason || null })
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ block: data })
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id
    if (!id) return res.status(400).json({ error: 'id é obrigatório' })
    const { error } = await db.from('schedule_blocks').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
