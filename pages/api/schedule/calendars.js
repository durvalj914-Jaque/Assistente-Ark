// GET  /api/schedule/calendars?tenant_id= → lista as agendas do Google conectado
// POST /api/schedule/calendars {tenant_id, calendar_id} → define em qual agenda o bot escreve
import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant } from '../../../lib/serverAuth'
import { listGoogleCalendars, getCalendarConn } from '../../../lib/googleCalendar'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  const auth = await requireTenant(req, res)
  if (!auth) return
  const tenantId = auth.tenant_id

  if (req.method === 'GET') {
    const { data: conn } = await db.from('calendar_connections')
      .select('google_email, calendar_id, ics_token').eq('tenant_id', tenantId).maybeSingle()
    if (!conn) return res.status(200).json({ connected: false, calendars: [] })
    const calendars = await listGoogleCalendars(db, tenantId)
    return res.status(200).json({
      connected: true, email: conn.google_email,
      current: conn.calendar_id || 'primary', calendars,
    })
  }

  if (req.method === 'POST') {
    const { calendar_id } = req.body || {}
    if (!calendar_id) return res.status(400).json({ error: 'calendar_id é obrigatório' })
    const conn = await getCalendarConn(db, tenantId)
    if (!conn) return res.status(404).json({ error: 'Google Agenda não conectado' })
    const { error } = await db.from('calendar_connections')
      .update({ calendar_id, last_synced_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, calendar_id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
