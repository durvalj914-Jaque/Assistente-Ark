// GET /api/calendar/ics?token=<ics_token> → feed ICS dos agendamentos confirmados
// Permite ao B2B assinar os agendamentos Ark direto no Google Agenda (Adicionar por URL)
import { createClient } from '@supabase/supabase-js'

function getDB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

function icsDate(date, time) {
  // 2026-09-10 + 14:30 → 20260910T143000 (-03:00 fixo, sem DST)
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

export default async function handler(req, res) {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'token obrigatório' })

  const db = getDB()
  const { data: conn } = await db.from('calendar_connections').select('tenant_id').eq('ics_token', token).maybeSingle()
  if (!conn) return res.status(404).json({ error: 'não encontrado' })

  const { data: appts } = await db.from('appointments')
    .select('id, date, start_time, end_time, customer_name, customer_phone, service_id')
    .eq('tenant_id', conn.tenant_id)
    .in('status', ['confirmed', 'completed'])
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date').order('start_time')
  const { data: svcs } = await db.from('services').select('id, name').eq('tenant_id', conn.tenant_id)
  const svcMap = Object.fromEntries((svcs || []).map(s => [s.id, s.name]))

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Assistente Ark//Agendamentos//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const a of appts || []) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:ark-appt-${a.id}@arkiel.com.br`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${(svcMap[a.service_id] || 'Atendimento')} — ${a.customer_name || 'Cliente'}`,
      `DTSTART:${icsDate(a.date, a.start_time)}`,
      `DTEND:${icsDate(a.date, a.end_time)}`,
      `DESCRIPTION:Cliente: ${a.customer_name || '-'}\\nWhatsApp: ${a.customer_phone || '-'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="agendamentos-ark.ics"')
  return res.status(200).send(lines.join('\r\n'))
}
