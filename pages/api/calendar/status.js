// GET /api/calendar/status?tenantId=... → status da conexão + URL do feed ICS
// DELETE /api/calendar/status?tenantId=... → desconecta
import { createClient } from '@supabase/supabase-js'

function getDB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const { tenantId } = req.query
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' })
  const db = getDB()

  if (req.method === 'DELETE') {
    await db.from('calendar_connections').delete().eq('tenant_id', tenantId)
    return res.status(200).json({ ok: true, connected: false })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data: conn } = await db.from('calendar_connections')
    .select('google_email, ics_token, last_synced_at').eq('tenant_id', tenantId).maybeSingle()

  return res.status(200).json({
    connected: !!conn,
    email: conn?.google_email || null,
    icsUrl: conn?.ics_token ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://arkiel.com.br'}/api/calendar/ics?token=${conn.ics_token}` : null,
    lastSyncedAt: conn?.last_synced_at || null,
  })
}
