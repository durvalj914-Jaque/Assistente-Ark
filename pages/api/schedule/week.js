// GET /api/schedule/week?tenant_id=&date=YYYY-MM-DD (opcional &service_id=, &slots_for=YYYY-MM-DD)
// Devolve a semana da agenda: dias, janelas de atendimento, bloqueios de data,
// agendamentos, bloqueios manuais e horários livres.
import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant } from '../../../lib/serverAuth'
import { buildFreeSlots, getDayWindow, isDateBlocked } from '../../../lib/scheduleEngine'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const db = supabaseAdmin()
  const auth = await requireTenant(req, res)
  if (!auth) return
  const tenantId = auth.tenant_id

  const base = req.query?.date ? new Date(req.query.date + 'T12:00:00') : new Date()
  const sunday = new Date(base); sunday.setDate(sunday.getDate() - sunday.getDay())

  const { data: cfg } = await db.from('booking_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
  const { data: svcs } = await db.from('services').select('id, name, duration_min').eq('tenant_id', tenantId).eq('is_active', true).order('created_at')

  // Duração sintética da grade: duração do serviço escolhido ou do 1º serviço
  const svcId = req.query?.service_id || svcs?.[0]?.id || null
  let dur = 60
  if (svcId) {
    const sv = (svcs || []).find(s => s.id === svcId)
    dur = Math.max(5, sv?.duration_min || 60)
  }

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday); d.setDate(d.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push(iso)
  }

  const { data: appts } = await db.from('appointments')
    .select('id, service_id, date, start_time, end_time, status, customer_name, customer_phone, payment_id, gcal_link')
    .eq('tenant_id', tenantId).in('date', days)
    .in('status', ['pending_payment', 'confirmed', 'draft'])
  const { data: blocks } = await db.from('schedule_blocks')
    .select('*').eq('tenant_id', tenantId).in('date', days)

  const svcNames = {}
  for (const s of (svcs || [])) svcNames[s.id] = s.name

  const out = []
  for (const iso of days) {
    const dow = new Date(iso + 'T12:00:00').getDay()
    const win = getDayWindow(cfg, dow)
    const blocked = isDateBlocked(cfg, iso)
    const dayAppts = (appts || []).filter(a => a.date === iso && a.status !== 'draft')
    const dayBlocks = (blocks || []).filter(b => b.date === iso)
    let freeSlots = []
    if (win && !blocked && svcId) {
      freeSlots = await buildFreeSlots(db, tenantId, iso, svcId, cfg, dur)
    }
    out.push({
      date: iso, dow,
      open: win ? win.open : null,
      close: win ? win.close : null,
      breakStart: win?.breakStart ?? null,
      breakEnd: win?.breakEnd ?? null,
      closed: !win, blocked,
      appointments: dayAppts.map(a => ({
        id: a.id, service_id: a.service_id, start_time: a.start_time, end_time: a.end_time, status: a.status,
        customer_name: a.customer_name, customer_phone: a.customer_phone,
        service_name: svcNames[a.service_id] || 'Atendimento',
        has_payment: !!a.payment_id, gcal_link: a.gcal_link || null,
      })),
      blocks: dayBlocks.map(b => ({ id: b.id, start_time: b.start_time, end_time: b.end_time, reason: b.reason })),
      freeSlots,
    })
  }

  // Slots de um dia específico (reagendamento) com duração do serviço real
  let slotsForDay = null
  if (req.query?.slots_for && req.query?.appt_service) {
    slotsForDay = await buildFreeSlots(db, tenantId, req.query.slots_for, req.query.appt_service, cfg)
  }

  return res.status(200).json({
    days: out,
    services: (svcs || []).map(s => ({ id: s.id, name: s.name, duration_min: s.duration_min })),
    slotsForDay,
    config: {
      capacity: cfg?.capacity ?? 1, buffer_min: cfg?.buffer_min ?? 0,
      min_lead_minutes: cfg?.min_lead_minutes ?? 30,
      reminders_enabled: cfg?.reminders_enabled ?? true,
      reminder_hours: cfg?.reminder_hours ?? 1,
      blocked_dates: cfg?.blocked_dates || [],
      day_hours: cfg?.day_hours || [],
      days_of_week: cfg?.days_of_week || '', open_time: cfg?.open_time, close_time: cfg?.close_time,
      slot_min: cfg?.slot_min, max_days_ahead: cfg?.max_days_ahead,
      break_start: cfg?.break_start, break_end: cfg?.break_end,
    },
  })
}
