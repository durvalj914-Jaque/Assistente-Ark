// POST /api/schedule/appointment-action
// Ações do painel sobre um agendamento: confirmar, cancelar, reagendar.
// Body: { tenant_id, appointment_id, action: 'confirm'|'cancel'|'reschedule', date?, start_time? }
// Sempre que possível notifica o cliente por WhatsApp (janela 24h aberta).
import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant } from '../../../lib/serverAuth'
import { buildFreeSlots } from '../../../lib/scheduleEngine'
import { sendText } from '../../../lib/meta'
import { checkConversationWindow } from '../../../lib/messageGuard'
import { pushAppointmentToGoogle, patchAppointmentInGoogle, deleteAppointmentFromGoogle } from '../../../lib/googleCalendar'

function fmtBR(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

// Notifica o cliente (best-effort): só envia texto livre se a janela 24h estiver aberta
async function notifyCustomer(db, appt, text) {
  try {
    if (!appt?.conversation_id && !appt?.contact_id) return { notified: false }
    const { data: bot } = await db.from('bots').select('id, phone_number_id, access_token').eq('id', appt.bot_id).maybeSingle()
    if (!bot?.phone_number_id) return { notified: false }
    const token = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2 || process.env.META_SYSTEM_USER_TOKEN

    const win = await checkConversationWindow(db, appt.bot_id, appt.contact_id)
    if (!win.window_open) return { notified: false, reason: 'window_closed' }

    await sendText(bot.phone_number_id, token, appt.customer_phone, text)
    await db.from('messages').insert({
      tenant_id: appt.tenant_id, conversation_id: appt.conversation_id, bot_id: appt.bot_id,
      contact_id: appt.contact_id, direction: 'outbound', type: 'text', content: text, sent_by: 'user',
    })
    return { notified: true }
  } catch (_) {
    return { notified: false }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const db = supabaseAdmin()
  const auth = await requireTenant(req, res)
  if (!auth) return
  const { appointment_id, action, date, start_time } = req.body || {}
  if (!appointment_id || !action) return res.status(400).json({ error: 'appointment_id e action são obrigatórios' })

  const { data: appt, error } = await db.from('appointments').select('*').eq('id', appointment_id).eq('tenant_id', auth.tenant_id).maybeSingle()
  if (error || !appt) return res.status(404).json({ error: 'Agendamento não encontrado' })
  const { data: svc } = await db.from('services').select('name, duration_min').eq('id', appt.service_id).maybeSingle()
  const dur = svc?.duration_min || 60
  const svcName = svc?.name || 'Atendimento'

  // ── CONFIRMAR ──
  if (action === 'confirm') {
    if (!['pending_payment', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ error: 'Só é possível confirmar agendamentos aguardando pagamento ou já confirmados' })
    }
    const changed = appt.status !== 'confirmed'
    await db.from('appointments').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', appt.id)
    if (changed) await pushAppointmentToGoogle(db, auth.tenant_id, appt)
    const n = await notifyCustomer(db, appt, `✅ *Agendamento confirmado!*\n\n${svcName} — ${fmtBR(appt.date)} às *${appt.start_time}*.\n\nAté lá! 🙌`)
    return res.status(200).json({ ok: true, notified: n.notified, notify_reason: n.reason || null })
  }

  // ── CANCELAR ──
  if (action === 'cancel') {
    if (!['pending_payment', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ error: 'Esse agendamento não está ativo' })
    }
    await db.from('appointments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', appt.id)
    if (appt.payment_id) {
      await db.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', appt.payment_id).eq('status', 'pending')
    }
    await deleteAppointmentFromGoogle(db, auth.tenant_id, appt)
    const n = await notifyCustomer(db, appt, `😕 *Agendamento cancelado*\n\nSeu ${svcName} de ${fmtBR(appt.date)} às ${appt.start_time} foi cancelado pela empresa. Pedimos desculpas! Quando quiser remarcar, responda aqui. 🙏`)
    return res.status(200).json({ ok: true, notified: n.notified, notify_reason: n.reason || null })
  }

  // ── REAGENDAR ──
  if (action === 'reschedule') {
    if (!['pending_payment', 'confirmed'].includes(appt.status)) {
      return res.status(400).json({ error: 'Esse agendamento não está ativo' })
    }
    if (!date || !start_time) return res.status(400).json({ error: 'date e start_time são obrigatórios para reagendar' })
    const free = await buildFreeSlots(db, auth.tenant_id, date, appt.service_id)
    // Ignora a vaga do próprio agendamento no dia original
    if (!free.includes(start_time) && !(date === appt.date && start_time === appt.start_time)) {
      return res.status(409).json({ error: 'Esse horário não está livre', freeSlots: free })
    }
    const [sh, sm] = start_time.split(':').map(Number)
    const endM = sh * 60 + sm + dur
    const end_time = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    const oldLabel = `${fmtBR(appt.date)} às ${appt.start_time}`
    await db.from('appointments').update({
      date, start_time, end_time, reminder_sent_at: null, updated_at: new Date().toISOString(),
    }).eq('id', appt.id)
    appt.date = date; appt.start_time = start_time; appt.end_time = end_time
    await patchAppointmentInGoogle(db, auth.tenant_id, appt)
    const n = await notifyCustomer(db, appt, `🔄 *Agendamento remarcado!*\n\nSeu ${svcName} mudou de ${oldLabel} para ${fmtBR(date)} às *${start_time}*.\n\nAté lá! 🙌`)
    return res.status(200).json({ ok: true, notified: n.notified, notify_reason: n.reason || null })
  }

  return res.status(400).json({ error: 'Ação inválida: confirm, cancel ou reschedule' })
}
