// ── Motor de agenda compartilhado (usado pelo webhook do bot e pelo painel) ──
// Regras suportadas: horário por dia da semana (day_hours), pausa (break),
// feriados/bloqueio de datas (blocked_dates), antecedência mínima
// (min_lead_minutes), buffer entre atendimentos (buffer_min), capacidade
// simultânea (capacity), bloqueios manuais (schedule_blocks) e Google Agenda.
import { getGoogleBusy } from './googleCalendar'
import { sendText } from './meta'

// '9:00' | '09:00:00' → minutos desde 00:00 (ou null se inválido)
export function normHM(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

// minutos → 'HH:MM'
export function hm(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// Agora no fuso de São Paulo (Vercel roda em UTC)
export function nowSP() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
}

// Janela de atendimento de um dia da semana (0=Dom..6=Sáb). null = não atende.
// Prioridade: day_hours (por dia). Fallback: days_of_week + open/close globais.
export function getDayWindow(cfg, dow) {
  const dh = Array.isArray(cfg?.day_hours) ? cfg.day_hours : []
  if (dh.length) {
    const d = dh.find(x => Number(x.idx) === Number(dow))
    if (!d) return null
    const open = normHM(d.open)
    const close = normHM(d.close)
    if (open == null || close == null || close <= open) return null
    return {
      open, close,
      breakStart: d.breakStart ? normHM(d.breakStart) : null,
      breakEnd: d.breakEnd ? normHM(d.breakEnd) : null,
    }
  }
  const days = (cfg?.days_of_week || '').split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
  if (!days.includes(Number(dow))) return null
  const open = normHM(cfg?.open_time || '09:00')
  const close = normHM(cfg?.close_time || '18:00')
  if (open == null || close == null || close <= open) return null
  return {
    open, close,
    breakStart: cfg?.break_start ? normHM(cfg.break_start) : null,
    breakEnd: cfg?.break_end ? normHM(cfg.break_end) : null,
  }
}

export function dayIsOpen(cfg, dow) {
  return getDayWindow(cfg, dow) !== null
}

export function isDateBlocked(cfg, date) {
  const arr = Array.isArray(cfg?.blocked_dates) ? cfg.blocked_dates : []
  return arr.includes(String(date).slice(0, 10))
}

// ── Motor principal: devolve até 12 horários livres ('HH:MM') ──
// durationOpt: duração sintética (agenda visual do painel, sem serviço real)
export async function buildFreeSlots(db, tenantId, date, serviceId, cfgOpt, durationOpt) {
  let cfg = cfgOpt
  if (!cfg) {
    const { data } = await db.from('booking_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
    cfg = data
  }
  const dateStr = String(date).slice(0, 10)
  if (isDateBlocked(cfg, dateStr)) return []

  const dow = new Date(dateStr + 'T12:00:00').getDay()
  const win = getDayWindow(cfg, dow)
  if (!win) return []

  let dur = durationOpt
  if (!dur) {
    const { data: svc } = await db.from('services').select('duration_min').eq('id', serviceId).maybeSingle()
    dur = Math.max(5, svc?.duration_min || 60)
  }
  dur = Math.max(5, dur)
  const step = Math.max(10, dur) // opções alinhadas à duração do serviço
  const probe = Math.max(5, Math.min(15, step)) // resolução de busca de lacunas
  const buffer = Math.max(0, parseInt(cfg?.buffer_min ?? 0, 10) || 0)
  const capacity = Math.max(1, parseInt(cfg?.capacity ?? 1, 10) || 1)
  const lead = Math.max(0, parseInt(cfg?.min_lead_minutes ?? 30, 10) || 0)

  // Ocupações soft: agendamentos do banco (contam para a capacidade)
  const { data: taken } = await db.from('appointments')
    .select('start_time, end_time').eq('tenant_id', tenantId).eq('date', dateStr)
    .in('status', ['pending_payment', 'confirmed'])
  const soft = []
  for (const t of (taken || [])) {
    const s = normHM(t.start_time)
    if (s == null) continue
    const e = normHM(t.end_time) ?? s + dur
    soft.push([s, Math.max(e, s + 5)])
  }

  // Ocupações hard: bloqueios manuais + Google + pausa do dia
  const hard = []
  try {
    const { data: blocks } = await db.from('schedule_blocks')
      .select('start_time, end_time').eq('tenant_id', tenantId).eq('date', dateStr)
    for (const b of (blocks || [])) {
      const s = normHM(b.start_time)
      const e = normHM(b.end_time)
      if (s != null && e != null && e > s) hard.push([s, e])
    }
  } catch (_) {}
  try {
    const gBusy = await getGoogleBusy(db, tenantId, dateStr)
    for (const b of (gBusy || [])) {
      const s = normHM(b.start)
      if (s == null) continue
      const e = normHM(b.end) ?? s + 60
      hard.push([s, Math.max(e, s + 5)])
    }
  } catch (_) {}
  if (win.breakStart != null && win.breakEnd != null && win.breakEnd > win.breakStart) {
    hard.push([win.breakStart, win.breakEnd])
  }

  const overlapsHard = (s) => hard.some(([bs, be]) => s < be && s + dur > bs)
  const softOverlapCount = (s) => soft.filter(([bs, be]) => s < be && s + dur > bs).length
  // buffer: folga após o fim de cada atendimento antes do próximo
  const overlapsSoftBuffer = (s) => buffer > 0 && soft.some(([bs, be]) => s < (be + buffer) && (s + dur) > bs)

  const now = nowSP()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isToday = dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const minStart = isToday ? nowMin + lead : 0

  const slots = []
  let cursor = win.open
  while (slots.length < 12) {
    while (cursor + dur <= win.close &&
      (overlapsHard(cursor) || overlapsSoftBuffer(cursor) || softOverlapCount(cursor) >= capacity || cursor < minStart)) {
      cursor += probe
    }
    if (cursor + dur > win.close) break
    slots.push(hm(cursor))
    cursor += Math.max(step, probe)
  }
  return slots
}

// ── Lembretes automáticos: envia WhatsApp para agendamentos que começam em
// menos de reminder_hours horas (marcando reminder_sent_at p/ idempotência) ──
export async function sendDueReminders(db, bot) {
  try {
    const tenantId = bot?.tenant_id
    if (!tenantId) return 0
    const { data: cfg } = await db.from('booking_settings')
      .select('reminders_enabled, reminder_hours').eq('tenant_id', tenantId).maybeSingle()
    if (cfg?.reminders_enabled === false) return 0
    const leadMin = Math.max(0, parseFloat(cfg?.reminder_hours ?? 1) * 60 || 60)

    const now = nowSP()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const { data: due } = await db.from('appointments')
      .select('*').eq('tenant_id', tenantId).eq('date', todayStr)
      .in('status', ['confirmed', 'pending_payment'])
      .is('reminder_sent_at', null)
    if (!due?.length) return 0

    const token = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2 || process.env.META_SYSTEM_USER_TOKEN
    const phoneId = bot.phone_number_id
    if (!token || !phoneId) return 0

    let sent = 0
    for (const appt of due) {
      const startMin = normHM(appt.start_time)
      if (startMin == null || startMin <= nowMin) continue // já começou, não lembra
      const missing = startMin - nowMin
      if (missing > leadMin) continue // ainda não chegou na janela do lembrete

      const { data: svc } = await db.from('services').select('name, duration_min').eq('id', appt.service_id).maybeSingle()
      const dur = svc?.duration_min || 60
      const endMin = (normHM(appt.end_time) ?? startMin + dur)
      const txt = `⏰ *Lembrete de horário*\n\nOlá${appt.customer_name ? ', ' + appt.customer_name : ''}! Passando pra lembrar do seu agendamento *hoje*, das *${appt.start_time}* às *${hm(endMin)}*${svc?.name ? ` — *${svc.name}*` : ''}.\n\nSe precisar remarcar ou cancelar, responda aqui. Até logo! 🙌`

      try {
        await sendText(phoneId, token, appt.customer_phone, txt)
        await db.from('messages').insert({
          tenant_id: tenantId, conversation_id: appt.conversation_id, bot_id: bot.id,
          contact_id: appt.contact_id, direction: 'outbound', type: 'text',
          content: txt, sent_by: 'bot',
        })
      } catch (_) { /* envio falhou: não marca como enviado pra tentar de novo */ }
      await db.from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', appt.id)
      sent++
    }
    return sent
  } catch (_) {
    return 0
  }
}
