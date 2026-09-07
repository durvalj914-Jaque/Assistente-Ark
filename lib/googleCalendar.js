// Integração Google Calendar — agendamentos Ark → agenda do B2B
import { createClient } from '@supabase/supabase-js'

const TZ = '-03:00' // America/Sao_Paulo (sem DST)

function getDB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

export function getGoogleOAuthCreds() {
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  }
}

export async function getCalendarConn(db, tenantId) {
  const { data } = await db.from('calendar_connections')
    .select('*').eq('tenant_id', tenantId).maybeSingle()
  return data
}

// Garante access token válido (renova via refresh_token se expirado)
export async function getValidAccessToken(db, tenantId) {
  const conn = await getCalendarConn(db, tenantId)
  if (!conn?.refresh_token) return { token: null, conn: null }

  if (conn.access_token && conn.token_expires_at && new Date(conn.token_expires_at) > new Date(Date.now() + 60000)) {
    return { token: conn.access_token, conn }
  }

  const { clientId, clientSecret } = getGoogleOAuthCreds()
  if (!clientId || !clientSecret) return { token: null, conn }

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const tok = await r.json()
    if (!tok.access_token) return { token: null, conn }
    const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString()
    await db.from('calendar_connections')
      .update({ access_token: tok.access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', conn.id)
    return { token: tok.access_token, conn }
  } catch (_) {
    return { token: null, conn }
  }
}

// Converte dateTime ISO → HH:MM no fuso de São Paulo
function isoToLocal(iso) {
  const d = new Date(iso)
  return `${String(d.getUTCHours() + 3).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// Busca períodos ocupados na agenda Google do tenant para uma data (YYYY-MM-DD)
// Retorna [{ start: 'HH:MM', end: 'HH:MM' }]
export async function getGoogleBusy(db, tenantId, date) {
  const { token, conn } = await getValidAccessToken(db, tenantId)
  if (!token) return []

  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: `${date}T00:00:00${TZ}`,
        timeMax: `${date}T23:59:59${TZ}`,
        items: [{ id: conn.calendar_id || 'primary' }],
      }),
    })
    const data = await r.json()
    const busy = Object.values(data.calendars || {}).flatMap(c => c.busy || [])
    return busy.map(b => ({ start: isoToLocal(b.start), end: isoToLocal(b.end) }))
  } catch (_) {
    return []
  }
}

// Cria evento na agenda Google para um agendamento confirmado (idempotente)
export async function pushAppointmentToGoogle(db, tenantId, appt) {
  if (!appt?.id) return null
  const { data: existing } = await db.from('appointments').select('google_event_id').eq('id', appt.id).maybeSingle()
  if (existing?.google_event_id) return existing.google_event_id

  const { token, conn } = await getValidAccessToken(db, tenantId)
  if (!token) return null

  const { data: svc } = await db.from('services').select('name').eq('id', appt.service_id).maybeSingle()

  const event = {
    summary: `${svc?.name || 'Atendimento Ark'} — ${appt.customer_name || 'Cliente'}`,
    description: `Agendamento via Assistente Ark\nCliente: ${appt.customer_name || '—'}\nWhatsApp: ${appt.customer_phone || '—'}`,
    start: { dateTime: `${appt.date}T${appt.start_time}:00${TZ}` },
    end:   { dateTime: `${appt.date}T${appt.end_time}:00${TZ}` },
  }

  try {
    const calId = conn.calendar_id || 'primary'
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }
    )
    const ev = await r.json()
    if (ev.id) {
      await db.from('appointments').update({ google_event_id: ev.id, updated_at: new Date().toISOString() }).eq('id', appt.id)
      return ev.id
    }
    return null
  } catch (_) {
    return null
  }
}
