import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import SectionHelp from '../../components/Tutorial/SectionHelp'


const labelStyle = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

// Definido FORA dos modais: se ficasse dentro, o React recriava esse componente
// a cada render (cada tecla digitada) e o input perdia o foco a cada caractere.
function Field({ label, name, value, onChange, placeholder, type = 'text', hint, textarea }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder} className="ark-input" rows={3} style={{ resize: 'vertical' }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder} className="ark-input" />
      )}
      {hint && <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

const SCHED_DAYS = [
  { idx: 0, label: 'Dom' }, { idx: 1, label: 'Seg' }, { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' }, { idx: 4, label: 'Qui' }, { idx: 5, label: 'Sex' }, { idx: 6, label: 'Sáb' },
]

const DOW_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Altura de 1 minuto na agenda visual
const PX_PER_MIN = 0.8

const APPT_STYLE = {
  pending_payment: { bg: 'rgba(245,158,11,0.85)', border: '#f59e0b' },
  confirmed:       { bg: 'rgba(34,197,94,0.85)', border: '#22c55e' },
}

// Serviço agendável do catálogo — pode ter taxa via PIX e duração na agenda
function ServiceModal({ service, tenantId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price ?? '',
    duration_min: service?.duration_min ?? 60,
    image_url: service?.image_url || '',
    is_active: service?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const setField = useCallback((name, value) => setForm(f => ({ ...f, [name]: value })), [])

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, price: form.price === '' ? 0 : parseFloat(form.price), duration_min: parseInt(form.duration_min, 10) || 60 }
    if (service?.id) {
      await supabase.from('services').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', service.id)
    } else {
      await supabase.from('services').insert({ ...payload, tenant_id: tenantId })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <Field label="NOME DO SERVIÇO" name="name" value={form.name} onChange={setField} placeholder="Ex: Consulta de rotina" hint="Aparece no menu do bot quando o cliente escolhe 📅 Agendar." />
        <Field label="DESCRIÇÃO" name="description" value={form.description} onChange={setField} placeholder="O que está incluído no atendimento" textarea />
        <label style={labelStyle}>IMAGEM DO SERVIÇO</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          {form.image_url ? (
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <img src={form.image_url} alt="Preview" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
              <button type="button" onClick={() => setField('image_url', '')} style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🖼️</div>
          )}
          <div style={{ flex: 1 }}>
            <input type="file" accept="image/png,image/jpeg,image/webp" id="service-img-upload" style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploadingImg(true)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  const r = await fetch('/api/products/upload-image', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
                    body: fd,
                  })
                  const d = await r.json()
                  if (d.imageUrl) setField('image_url', d.imageUrl)
                  else alert(d.error || 'Erro no upload')
                } catch (err) {
                  alert('Falha no upload da imagem')
                }
                setUploadingImg(false)
              }} />
            <label htmlFor="service-img-upload" className="ark-btn" style={{ display: 'inline-block', cursor: 'pointer', fontSize: 12, padding: '8px 14px' }}>
              {uploadingImg ? 'Enviando…' : form.image_url ? '📷 Trocar imagem' : '📷 Enviar imagem'}
            </label>
            <p style={{ color: '#64748b', fontSize: 11, margin: '8px 0 0' }}>JPG, PNG ou WebP. Enviada no WhatsApp quando o cliente escolhe o serviço.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="TAXA DE AGENDAMENTO (R$)"  name="price" value={form.price} onChange={setField} type="number" placeholder="0.00" hint="0 = grátis. Se &gt; 0, o cliente paga via PIX pra confirmar o horário." />
          <Field label="DURAÇÃO (min)" name="duration_min" value={form.duration_min} onChange={setField} type="number" placeholder="60" hint="Tamanho do horário na agenda." />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 18 }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Serviço ativo (aparece no bot)</span>
        </label>
        <button onClick={handleSave} disabled={saving} className="ark-btn-primary" style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          {saving ? 'Salvando…' : service ? 'Salvar alterações' : 'Criar serviço'}
        </button>
      </div>
    </div>
  )
}

const STATUS_MAP = {
  draft:          { label: 'Rascunho',   color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  pending_payment:{ label: 'Aguard. pagamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  confirmed:      { label: 'Confirmado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled:      { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  completed:      { label: 'Concluído',  color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' },
}

function StatusChip({ status, map }) {
  const cfg = map[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.15)' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ── Modal de ações sobre um agendamento (confirmar / cancelar / reagendar) ──
function ApptActionModal({ appt, tenantId, onClose, onDone }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [resched, setResched] = useState(false)
  const [newDate, setNewDate] = useState(appt.date)
  const [slots, setSlots] = useState([])
  const [newSlot, setNewSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)

  async function authFetch(url, opts = {}) {
    const token = (await supabase.auth.getSession()).data?.session?.access_token || ''
    return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  }

  async function doAction(action, extra = {}) {
    setBusy(true)
    try {
      const r = await authFetch('/api/schedule/appointment-action', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId, appointment_id: appt.id, action, ...extra }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: 'err', text: d.error || 'Erro' }); setBusy(false); return }
      if (action === 'reschedule') { onDone(d); setBusy(false); return }
      const notificado = d.notified
        ? '✅ Cliente notificado no WhatsApp.'
        : '⚠️ Cliente não notificado (janela de 24h fechada — ele verá no bot na próxima interação).'
      setMsg({ type: 'ok', text: action === 'confirm' ? `Agendamento confirmado. ${notificado}` : `Agendamento cancelado. ${notificado}` })
      setTimeout(() => onDone(d), 1200)
    } catch (e) {
      setMsg({ type: 'err', text: 'Falha de conexão' }); setBusy(false)
    }
  }

  async function loadSlots(dateStr) {
    setLoadingSlots(true); setSlots([]); setNewSlot('')
    try {
      const r = await authFetch(`/api/schedule/week?tenant_id=${tenantId}&date=${dateStr}&slots_for=${dateStr}&appt_service=${appt.service_id}`)
      const d = await r.json()
      setSlots(d.slotsForDay || [])
    } catch (_) {}
    setLoadingSlots(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{appt.service_name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>
                {new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} · {appt.start_time}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{appt.customer_name} · {appt.customer_phone}</div>
            </div>
            <StatusChip status={appt.status} map={STATUS_MAP} />
          </div>
        </div>

        {msg && (
          <div style={{ background: msg.type === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: msg.type === 'ok' ? '#22c55e' : '#ef4444', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13 }}>
            {msg.text}
          </div>
        )}

        {!resched ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {appt.status === 'pending_payment' && (
              <button onClick={() => doAction('confirm')} disabled={busy} style={{ ...btnPrimary }}>✅ Confirmar agendamento</button>
            )}
            <button onClick={() => { setResched(true); loadSlots(appt.date) }} disabled={busy} style={{ ...btnGhost }}>🔄 Reagendar</button>
            <button onClick={() => doAction('cancel')} disabled={busy} style={{ ...btnDanger }}>🗑️ Cancelar (avisa o cliente)</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>NOVA DATA</label>
            <input type="date" value={newDate} className="ark-input"
              onChange={e => { setNewDate(e.target.value); if (e.target.value) loadSlots(e.target.value) }} />
            <label style={labelStyle}>NOVO HORÁRIO {loadingSlots && <span style={{ color: '#4f8ef7' }}>· carregando…</span>}</label>
            {slots.length === 0 && !loadingSlots
              ? <div style={{ color: '#94a3b8', fontSize: 12 }}>Sem horários livres nesse dia.</div>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {slots.map(s => (
                    <button key={s} onClick={() => setNewSlot(s)} style={{
                      padding: '7px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      borderColor: newSlot === s ? '#22c55e' : 'rgba(255,255,255,0.15)',
                      background: newSlot === s ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
                      color: newSlot === s ? '#22c55e' : '#94a3b8',
                    }}>{s}</button>
                  ))}
                </div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <button onClick={() => setResched(false)} style={{ ...btnGhost }}>← Voltar</button>
              <button onClick={() => doAction('reschedule', { date: newDate, start_time: newSlot })} disabled={busy || !newSlot} style={{ ...btnPrimary }}>Confirmar remarcação</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal de bloqueio manual de horário ──
function BlockModal({ date, start, tenantId, onClose, onSaved, authFetch }) {
  const [form, setForm] = useState({ date, start_time: start || '09:00', end_time: addMin(start || '09:00', 60), reason: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function save() {
    setBusy(true); setErr(null)
    try {
      const r = await authFetch('/api/schedule/blocks', { method: 'POST', body: JSON.stringify({ ...form, tenant_id: tenantId }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Erro'); setBusy(false); return }
      onSaved()
    } catch (_) { setErr('Falha de conexão'); setBusy(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>🚫 Bloquear horário</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 16px' }}>O período fica fora da agenda do bot (folga, reunião, compromisso pessoal).</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <Field label="DATA" name="date" value={form.date} onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} type="date" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="DE" name="start_time" value={form.start_time} onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} type="time" />
            <Field label="ATÉ" name="end_time" value={form.end_time} onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} type="time" />
          </div>
          <Field label="MOTIVO (interno)" name="reason" value={form.reason} onChange={(n, v) => setForm(f => ({ ...f, [n]: v }))} placeholder="Ex: almoço de empresa" />
        </div>
        {err && <p style={{ color: '#ef4444', fontSize: 12 }}>{err}</p>}
        <button onClick={save} disabled={busy} style={{ ...btnPrimary, width: '100%' }}>{busy ? 'Salvando…' : 'Bloquear horário'}</button>
      </div>
    </div>
  )
}

const btnPrimary = { background: 'var(--accent, #22c55e)', color: '#0d0d1a', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const btnGhost = { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnDanger = { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }

function addMin(hhmm, min) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + min
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export default function AgendamentosPage() {
  const router = useRouter()
  const { user, tenant, loading } = useTenant()
  const [tab, setTab] = useState('agendamentos') // agendamentos | servicos | horarios

  const [appointments, setAppointments] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [services, setServices] = useState([])
  const [booking, setBooking] = useState(null)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [calStatus, setCalStatus] = useState(null)
  const [savingConfig, setSavingConfig] = useState(false)

  // Agenda visual (semana)
  const [weekData, setWeekData] = useState(null)
  const [weekAnchor, setWeekAnchor] = useState(() => new Date().toISOString().slice(0, 10))
  const [weekLoading, setWeekLoading] = useState(false)
  const [selAppt, setSelAppt] = useState(null)
  const [blockDraft, setBlockDraft] = useState(null)

  // Horários por dia (editor)
  const [dayRows, setDayRows] = useState(null) // modo personalizado
  const [blockedDateInput, setBlockedDateInput] = useState('')
  const [calendars, setCalendars] = useState(null)

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadAppointments()
    loadServices()
    loadBooking()
    loadCalStatus()
    loadWeek()
    loadCalendars()
  }, [tenant])

  useEffect(() => { if (tenant) loadWeek() }, [weekAnchor])

  async function authFetch(url, opts = {}) {
    const token = (await supabase.auth.getSession()).data?.session?.access_token || ''
    return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })
  }

  async function loadAppointments() {
    setLoadingData(true)
    const today = new Date().toISOString().slice(0, 10)
    const appts = await supabase.from('appointments').select('*, services(name, duration_min)').eq('tenant_id', tenant.id).gte('date', today).order('date').order('start_time')
    setAppointments(appts.data || [])
    setLoadingData(false)
  }

  function loadServices() {
    supabase.from('services').select('*').eq('tenant_id', tenant.id).order('created_at')
      .then(({ data }) => setServices(data || []))
  }

  function loadBooking() {
    supabase.from('booking_settings').select('*').eq('tenant_id', tenant.id).maybeSingle()
      .then(({ data }) => {
        const b = data || { tenant_id: tenant.id, days_of_week: '1,2,3,4,5', open_time: '09:00', close_time: '18:00', slot_min: 60, max_days_ahead: 14, blocked_dates: [], min_lead_minutes: 30, buffer_min: 0, capacity: 1, reminders_enabled: true, reminder_hours: 1 }
        setBooking(b)
        // Editor por dia: parte do day_hours salvo, senão do legado
        const dh = Array.isArray(b.day_hours) && b.day_hours.length ? b.day_hours : null
        const globalDays = (b.days_of_week || '1,2,3,4,5').split(',').map(Number)
        setDayRows(SCHED_DAYS.map(d => {
          const row = dh?.find(x => Number(x.idx) === d.idx)
          return {
            idx: d.idx,
            on: row ? true : (dh ? false : globalDays.includes(d.idx)),
            open: row?.open || b.open_time || '09:00',
            close: row?.close || b.close_time || '18:00',
            breakStart: row?.breakStart || b.break_start || '',
            breakEnd: row?.breakEnd || b.break_end || '',
          }
        }))
      })
  }

  function loadCalStatus() {
    supabase.auth.getSession().then(({ data }) =>
      fetch(`/api/calendar/status?tenantId=${tenant.id}`, { headers: { Authorization: `Bearer ${data?.session?.access_token || ''}` } })
    ).then(r => r.json()).then(setCalStatus).catch(() => {})
  }

  async function loadCalendars() {
    try {
      const r = await authFetch(`/api/schedule/calendars?tenant_id=${tenant.id}`)
      const d = await r.json()
      setCalendars(d)
    } catch (_) { setCalendars({ connected: false, calendars: [] }) }
  }

  async function loadWeek() {
    setWeekLoading(true)
    try {
      const r = await authFetch(`/api/schedule/week?tenant_id=${tenant.id}&date=${weekAnchor}`)
      const d = await r.json()
      setWeekData(d)
    } catch (_) { setWeekData(null) }
    setWeekLoading(false)
  }

  function refreshAll() {
    loadAppointments()
    loadWeek()
    loadBooking()
  }

  // ── Salvar horários (global ou por dia), regras, feriados, lembretes ──
  async function saveBookingCfg(extra = {}) {
    if (!booking) return
    setSavingConfig(true)
    const perDay = dayRows?.some(r => r.on) && perDayMode()
    const payload = {
      tenant_id: booking.tenant_id,
      days_of_week: perDay
        ? dayRows.filter(r => r.on).map(r => r.idx).sort((a, b) => a - b).join(',') || booking.days_of_week
        : booking.days_of_week,
      open_time: booking.open_time, close_time: booking.close_time,
      break_start: booking.break_start || null, break_end: booking.break_end || null,
      day_hours: perDay
        ? dayRows.filter(r => r.on).map(r => ({ idx: r.idx, open: r.open, close: r.close, breakStart: r.breakStart || null, breakEnd: r.breakEnd || null }))
        : [],
      blocked_dates: booking.blocked_dates || [],
      min_lead_minutes: parseInt(booking.min_lead_minutes ?? 30, 10) || 0,
      buffer_min: parseInt(booking.buffer_min ?? 0, 10) || 0,
      capacity: Math.max(1, parseInt(booking.capacity ?? 1, 10) || 1),
      slot_min: parseInt(booking.slot_min, 10) || 60,
      max_days_ahead: parseInt(booking.max_days_ahead, 10) || 14,
      reminders_enabled: booking.reminders_enabled ?? true,
      reminder_hours: Math.max(0, parseFloat(booking.reminder_hours ?? 1)) || 0,
      updated_at: new Date().toISOString(),
      ...extra,
    }
    await supabase.from('booking_settings').upsert(payload, { onConflict: 'tenant_id' })
    setSavingConfig(false)
    loadWeek()
  }

  function perDayMode() {
    return Array.isArray(booking?.day_hours) && booking.day_hours.length > 0
  }

  function enablePerDay() {
    // Congela os valores atuais como base dos 7 dias
    setDayRows(rows => rows.map(r => ({ ...r, on: true })))
    setBooking(b => ({ ...b, day_hours: [{ idx: 1 }] })) // marca modo personalizado; valores reais salvos no Salvar
  }

  function disablePerDay() {
    setBooking(b => ({ ...b, day_hours: [] }))
  }

  function updDayRow(idx, patch) {
    setDayRows(rows => rows.map(r => r.idx === idx ? { ...r, ...patch } : r))
  }

  function toggleSchedDay(idx) {
    const days = new Set((booking.days_of_week || '').split(',').map(Number))
    if (days.has(idx)) days.delete(idx); else days.add(idx)
    if (days.size === 0) return
    setBooking(b => ({ ...b, days_of_week: [...days].sort().join(',') }))
  }

  function addBlockedDate() {
    if (!blockedDateInput) return
    const arr = booking.blocked_dates || []
    if (!arr.includes(blockedDateInput)) setBooking(b => ({ ...b, blocked_dates: [...arr, blockedDateInput].sort() }))
    setBlockedDateInput('')
  }

  function removeBlockedDate(d) {
    setBooking(b => ({ ...b, blocked_dates: (b.blocked_dates || []).filter(x => x !== d) }))
  }

  async function disconnectCalendar() {
    await fetch(`/api/calendar/status?tenantId=${tenant.id}`, { method: 'DELETE' })
    loadCalStatus()
    loadCalendars()
  }

  async function saveCalendarPick(calendarId) {
    await authFetch('/api/schedule/calendars', { method: 'POST', body: JSON.stringify({ tenant_id: tenant.id, calendar_id: calendarId }) })
    setCalendars(c => ({ ...c, current: calendarId }))
  }

  // ── Click na agenda visual ──
  function handleWeekClick(day, ev) {
    if (day.closed || day.blocked) return
    const rect = ev.currentTarget.getBoundingClientRect()
    const y = ev.clientY - rect.top
    const minutes = day.open + Math.round(y / PX_PER_MIN / 15) * 15
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
    const mm = String(minutes % 60).padStart(2, '0')
    setBlockDraft({ date: day.date, start: `${hh}:${mm}` })
  }

  function fmtDate(d) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) }

  const TABS = [
    { id: 'agendamentos', label: '📋 Agendamentos' },
    { id: 'servicos', label: '📅 Serviços' },
    { id: 'horarios', label: '⏰ Horários & Google Agenda' },
  ]

  // Faixa de horas da semana visível (pra alinhar as colunas)
  const weekOpenDays = (weekData?.days || []).filter(d => d.open != null)
  const gridStart = weekOpenDays.length ? Math.min(...weekOpenDays.map(d => d.open)) : 9 * 60
  const gridEnd = weekOpenDays.length ? Math.max(...weekOpenDays.map(d => d.close)) : 18 * 60
  const gridH = (gridEnd - gridStart) * PX_PER_MIN
  const hourLines = []
  for (let m = Math.ceil(gridStart / 60) * 60; m < gridEnd; m += 60) hourLines.push(m)

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🗓️ Agendamentos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Serviços, horários de atendimento, Google Agenda e as marcações dos clientes — tudo de agendamento em um só lugar.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: tab === t.id ? 'var(--accent, #22c55e)' : 'rgba(255,255,255,0.05)',
                color: tab === t.id ? '#0d0d1a' : '#94a3b8',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {showServiceModal && (
          <ServiceModal service={editingService} tenantId={tenant?.id} onSaved={() => { setShowServiceModal(false); setEditingService(null); loadServices() }} onClose={() => { setShowServiceModal(false); setEditingService(null) }} />
        )}

      {selAppt && (
        <ApptActionModal
          appt={selAppt} tenantId={tenant?.id}
          authFetch={authFetch}
          onClose={() => setSelAppt(null)}
          onDone={() => { setSelAppt(null); refreshAll() }}
        />
      )}

      {blockDraft && (
        <BlockModal
          date={blockDraft.date} start={blockDraft.start} tenantId={tenant?.id} authFetch={authFetch}
          onClose={() => setBlockDraft(null)}
          onSaved={() => { setBlockDraft(null); refreshAll() }}
        />
      )}

      {/* ══════════ ABA 1: AGENDA VISUAL + LISTA ══════════ */}
      {tab === 'agendamentos' && (
        <>
          <div className="ark-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0 }}>📆 Sua semana<SectionHelp t='products' s='horarios' /></h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => shiftWeek(-7)} style={{ ...btnGhost, padding: '6px 12px' }}>←</button>
                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                  {weekData?.days?.length ? `${fmtDate(weekData.days[0].date)} – ${fmtDate(weekData.days[6].date)}` : '…'}
                </span>
                <button onClick={() => shiftWeek(7)} style={{ ...btnGhost, padding: '6px 12px' }}>→</button>
                <button onClick={() => setWeekAnchor(new Date().toISOString().slice(0, 10))} style={{ ...btnGhost, padding: '6px 12px' }}>Hoje</button>
              </div>
            </div>

            {weekLoading && !weekData ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>Carregando agenda…</p>
            ) : !weekData || !services?.length ? (
              <p style={{ color: '#64748b', fontSize: 13 }}>Cadastre serviços na aba 📅 Serviços pra a agenda visual ganhar vida.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', minWidth: 720, gap: 4 }}>
                  {/* Cabeçalho */}
                  <div />
                  {(weekData.days || []).map(d => (
                    <div key={d.date} style={{ textAlign: 'center', paddingBottom: 8 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>{fmtDate(d.date)}</div>
                      <div style={{ fontSize: 10, color: d.closed || d.blocked ? '#ef4444' : '#22c55e', fontWeight: 600, marginTop: 2 }}>
                        {d.blocked ? 'folga' : d.closed ? 'fechado' : `${hmLabel(d.open)}–${hmLabel(d.close)}`}
                      </div>
                    </div>
                  ))}
                  {/* Coluna de horas + dias */}
                  <div style={{ position: 'relative', height: gridH }}>
                    {hourLines.map(m => (
                      <div key={m} style={{ position: 'absolute', top: (m - gridStart) * PX_PER_MIN, right: 4, fontSize: 10, color: '#64748b', transform: 'translateY(-50%)' }}>
                        {hmLabel(m)}
                      </div>
                    ))}
                  </div>
                  {(weekData.days || []).map(day => (
                    <div key={day.date} onClick={ev => handleWeekClick(day, ev)}
                      style={{
                        position: 'relative', height: gridH, background: day.closed || day.blocked ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                        borderRadius: 8, cursor: day.closed || day.blocked ? 'default' : 'pointer', overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }} title={day.closed || day.blocked ? '' : 'Clique pra bloquear um horário'}>
                      {/* linhas de hora */}
                      {hourLines.map(m => (
                        <div key={m} style={{ position: 'absolute', left: 0, right: 0, top: (m - gridStart) * PX_PER_MIN, borderTop: '1px dashed rgba(255,255,255,0.05)' }} />
                      ))}
                      {/* pausa do almoço */}
                      {day.breakStart != null && day.breakEnd != null && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: (day.breakStart - gridStart) * PX_PER_MIN, height: (day.breakEnd - day.breakStart) * PX_PER_MIN, background: 'rgba(100,116,139,0.15)' }} />
                      )}
                      {/* agendamentos */}
                      {day.appointments.map(a => {
                        const [sh, sm] = a.start_time.split(':').map(Number)
                        const [eh, em] = (a.end_time || addMin(a.start_time, 60)).split(':').map(Number)
                        const top = (sh * 60 + sm - gridStart) * PX_PER_MIN
                        const h = Math.max(18, ((eh * 60 + em) - (sh * 60 + sm)) * PX_PER_MIN - 2)
                        const st = APPT_STYLE[a.status] || APPT_STYLE.pending_payment
                        return (
                          <div key={a.id} onClick={ev => { ev.stopPropagation(); setSelAppt(a) }}
                            style={{ position: 'absolute', left: 2, right: 2, top, height: h, borderRadius: 6, background: st.bg, border: `1px solid ${st.border}`, padding: '3px 5px', overflow: 'hidden', cursor: 'pointer' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{a.start_time} {a.service_name}</div>
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.1 }}>{a.customer_name}</div>
                          </div>
                        )
                      })}
                      {/* bloqueios manuais */}
                      {day.blocks.map(b => {
                        const [sh, sm] = b.start_time.split(':').map(Number)
                        const [eh, em] = b.end_time.split(':').map(Number)
                        const top = (sh * 60 + sm - gridStart) * PX_PER_MIN
                        const h = Math.max(14, ((eh * 60 + em) - (sh * 60 + sm)) * PX_PER_MIN - 2)
                        return (
                          <div key={b.id} onClick={ev => ev.stopPropagation()}
                            style={{ position: 'absolute', left: 2, right: 2, top, height: h, borderRadius: 6, background: 'repeating-linear-gradient(45deg, rgba(239,68,68,0.35), rgba(239,68,68,0.35) 4px, rgba(239,68,68,0.15) 4px, rgba(239,68,68,0.15) 8px)', border: '1px solid #ef4444', padding: '2px 5px', overflow: 'hidden' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#fecaca' }}>🚫 {b.reason || 'bloqueado'}</div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
              Clique num espaço livre pra <b>bloquear um horário</b> · clique num agendamento pra <b>confirmar, remarcar ou cancelar</b>.
            </p>
          </div>

          {/* lista clássica */}
          {loadingData ? (
            <p style={{ color: '#64748b' }}>Carregando…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appointments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>📅</div>
                  Nenhum agendamento futuro.
                  <br />Cadastre serviços na sub-aba <b>📅 Serviços</b> acima e adicione o bloco 📅 no fluxo do bot.
                </div>
              )}
              {appointments.map(a => (
                <div key={a.id} className="ark-card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }}
                  onClick={() => setSelAppt({
                    id: a.id, service_id: a.service_id, date: a.date, start_time: a.start_time, end_time: a.end_time,
                    status: a.status, customer_name: a.customer_name, customer_phone: a.customer_phone,
                    service_name: a.services?.name || 'Atendimento',
                  })}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>
                      {fmtDate(a.date)} · {a.start_time} <span style={{ color: '#64748b', fontWeight: 500 }}>({a.services?.name || 'Atendimento'})</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{a.customer_name} · {a.customer_phone}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {a.reminder_sent_at && <span title="Lembrete enviado" style={{ fontSize: 11 }}>⏰✓</span>}
                    <StatusChip status={a.status} map={STATUS_MAP} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════ ABA 2: SERVIÇOS ══════════ */}
      {tab === 'servicos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Serviços que seus clientes agendam pelo bot — com taxa via PIX pra garantir o compromisso.<SectionHelp t='products' s='servicos' /></p>
            <button onClick={() => { setEditingService(null); setShowServiceModal(true) }} className="ark-btn-primary" style={{ padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              + Novo serviço
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {services.map(sv => (
              <div key={sv.id} className="ark-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{sv.name}</div>
                  <StatusChip status={sv.is_active ? 'confirmed' : 'cancelled'} map={{ confirmed: STATUS_MAP.confirmed, cancelled: STATUS_MAP.cancelled }} />
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, margin: '6px 0' }}>{sv.description || '—'}</div>
                <div style={{ display: 'flex', gap: 12, color: '#64748b', fontSize: 12 }}>
                  <span>⏱️ {sv.duration_min} min</span>
                  <span>💰 {parseFloat(sv.price) > 0 ? `R$ ${parseFloat(sv.price).toFixed(2)}` : 'Grátis'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setEditingService(sv); setShowServiceModal(true) }} style={{ ...btnGhost, padding: '7px 12px', fontSize: 12 }}>✏️ Editar</button>
                  <button onClick={async () => {
                    if (!confirm(`Excluir "${sv.name}"?`)) return
                    await supabase.from('services').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', sv.id)
                    loadServices()
                  }} style={{ ...btnDanger, padding: '7px 12px', fontSize: 12 }}>🗑️ Desativar</button>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)' }}>
                Nenhum serviço ainda. Crie o primeiro pra o bot começar a agendar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ ABA 3: HORÁRIOS, REGRAS, GOOGLE ══════════ */}
      {tab === 'horarios' && booking && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>

          {/* ── Horários de atendimento ── */}
          <div className="ark-card" style={{ padding: 20 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>⏰ Horários de atendimento<SectionHelp t='products' s='horarios' /></h3>
            <p style={{ color: '#475569', fontSize: 12, margin: '0 0 14px' }}>Quando o bot pode marcar atendimentos.</p>

            {!perDayMode() ? (
              <>
                <label style={labelStyle}>DIAS QUE ATENDE</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {SCHED_DAYS.map(d => {
                    const on = (booking.days_of_week || '').split(',').map(Number).includes(d.idx)
                    return (
                      <button key={d.idx} type="button" onClick={() => toggleSchedDay(d.idx)}
                        style={{ width: 44, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: on ? 'var(--accent, #22c55e)' : 'rgba(255,255,255,0.05)', color: on ? '#0d0d1a' : '#94a3b8' }}>{d.label}</button>
                    )
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="ABRE ÀS" name="open_time" value={booking.open_time} onChange={(n, v) => setBooking(b => ({ ...b, open_time: v }))} type="time" />
                  <Field label="FECHA ÀS" name="close_time" value={booking.close_time} onChange={(n, v) => setBooking(b => ({ ...b, close_time: v }))} type="time" />
                </div>
                <label style={{ ...labelStyle, marginTop: 8 }}>INTERVALO / PAUSA (opcional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="PAUSA COMEÇA" name="break_start" value={booking.break_start || ''} onChange={(n, v) => setBooking(b => ({ ...b, break_start: v }))} type="time" />
                  <Field label="PAUSA TERMINA" name="break_end" value={booking.break_end || ''} onChange={(n, v) => setBooking(b => ({ ...b, break_end: v }))} type="time" />
                </div>
                <button onClick={enablePerDay} style={{ ...btnGhost, width: '100%', marginTop: 4, fontSize: 12 }}>⚙️ Personalizar por dia (horários diferentes)</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>MODO POR DIA ATIVO</span>
                  <button onClick={disablePerDay} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>usar o mesmo horário pra todos</button>
                </div>
                {dayRows?.map(row => (
                  <div key={row.idx} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr 1fr', gap: 8, alignItems: 'end', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <button type="button" onClick={() => updDayRow(row.idx, { on: !row.on })}
                      style={{ padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: row.on ? 'var(--accent, #22c55e)' : 'rgba(255,255,255,0.05)', color: row.on ? '#0d0d1a' : '#64748b' }}>
                      {SCHED_DAYS[row.idx].label}
                    </button>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Abre</label>
                      <input type="time" value={row.open} disabled={!row.on} className="ark-input" style={{ padding: '6px 8px' }}
                        onChange={e => updDayRow(row.idx, { open: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Fecha</label>
                      <input type="time" value={row.close} disabled={!row.on} className="ark-input" style={{ padding: '6px 8px' }}
                        onChange={e => updDayRow(row.idx, { close: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, marginBottom: 3 }}>Pausa</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="time" value={row.breakStart || ''} disabled={!row.on} className="ark-input" style={{ padding: '6px 4px', minWidth: 0, flex: 1 }}
                          onChange={e => updDayRow(row.idx, { breakStart: e.target.value })} />
                        <span style={{ color: '#64748b', fontSize: 10 }}>–</span>
                        <input type="time" value={row.breakEnd || ''} disabled={!row.on} className="ark-input" style={{ padding: '6px 4px', minWidth: 0, flex: 1 }}
                          onChange={e => updDayRow(row.idx, { breakEnd: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            <button onClick={() => saveBookingCfg()} disabled={savingConfig} className="ark-btn-primary" style={{ width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              {savingConfig ? 'Salvando…' : 'Salvar horários'}
            </button>
          </div>

          {/* ── Feriados e folgas ── */}
          <div className="ark-card" style={{ padding: 20 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>🚫 Feriados e folgas</h3>
            <p style={{ color: '#475569', fontSize: 12, margin: '0 0 14px' }}>Datas em que a agenda fica fechada — sem apagar sua rotina semanal.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="date" value={blockedDateInput} onChange={e => setBlockedDateInput(e.target.value)} className="ark-input" style={{ flex: 1 }} />
              <button onClick={addBlockedDate} className="ark-btn-primary" style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Bloquear</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {((booking.blocked_dates || []).length === 0) && (
                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Nenhuma data bloqueada. Férias, feriados e folgas entram aqui.</p>
              )}
              {(booking.blocked_dates || []).sort().map(d => (
                <div key={d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ color: '#fecaca', fontSize: 12, fontWeight: 600 }}>
                    🚫 {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <button onClick={() => removeBlockedDate(d)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => saveBookingCfg()} disabled={savingConfig} className="ark-btn-primary" style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, opacity: 0.9 }}>
              {savingConfig ? 'Salvando…' : 'Salvar datas'}
            </button>
          </div>

          {/* ── Regras de agendamento ── */}
          <div className="ark-card" style={{ padding: 20 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>⚙️ Regras de agendamento</h3>
            <p style={{ color: '#475569', fontSize: 12, margin: '0 0 14px' }}>Como o bot escolhe os horários que oferece.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="ANTECEDÊNCIA MÍNIMA (min)" name="min_lead_minutes" value={booking.min_lead_minutes ?? 30} onChange={(n, v) => setBooking(b => ({ ...b, min_lead_minutes: v }))} type="number" hint="Não deixar agendar com menos que isso." />
              <Field label="BUFFER ENTRE ATENDIMENTOS (min)" name="buffer_min" value={booking.buffer_min ?? 0} onChange={(n, v) => setBooking(b => ({ ...b, buffer_min: v }))} type="number" hint="Folga depois de cada atendimento." />
              <Field label="ATENDIMENTOS SIMULTÂNEOS" name="capacity" value={booking.capacity ?? 1} onChange={(n, v) => setBooking(b => ({ ...b, capacity: v }))} type="number" hint="2+ cadeiras/profissionais no mesmo horário." />
              <Field label="AGENDA ATÉ (dias)" name="max_days_ahead" value={booking.max_days_ahead} onChange={(n, v) => setBooking(b => ({ ...b, max_days_ahead: v }))} type="number" hint="Quantos dias à frente o cliente pode agendar." />
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8, paddingTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
                <input type="checkbox" checked={booking.reminders_enabled ?? true} onChange={e => setBooking(b => ({ ...b, reminders_enabled: e.target.checked }))} />
                <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>🔔 Lembrete automático no WhatsApp</span>
              </label>
              {booking.reminders_enabled !== false && (
                <Field label="AVISAR QUANTAS HORAS ANTES" name="reminder_hours" value={booking.reminder_hours ?? 1} onChange={(n, v) => setBooking(b => ({ ...b, reminder_hours: v }))} type="number" hint="Reduz faltoso: o cliente recebe um lembrete no WhatsApp antes do horário." />
              )}
            </div>

            <button onClick={() => saveBookingCfg()} disabled={savingConfig} className="ark-btn-primary" style={{ width: '100%', marginTop: 8, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              {savingConfig ? 'Salvando…' : 'Salvar regras'}
            </button>
          </div>

          {/* ── Google Agenda ── */}
          <div className="ark-card" style={{ padding: 20 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>🔗 Google Agenda<SectionHelp t='products' s='google-agenda' /></h3>
            <p style={{ color: '#475569', fontSize: 12, margin: '0 0 14px' }}>
              O bot consulta os horários ocupados do seu Google antes de oferecer slots, e cada agendamento confirmado entra automaticamente no seu calendário.
            </p>
            {calStatus?.connected ? (
              <div>
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>✓ Conectado{calStatus.email ? ` — ${calStatus.email}` : ''}</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Horários do Google bloqueiam automaticamente a agenda do bot.</div>
                </div>

                {calendars?.calendars?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>ESCREVER EM QUAL AGENDA</label>
                    <select className="ark-input" value={calendars.current || 'primary'} onChange={e => saveCalendarPick(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px' }}>
                      {calendars.calendars.map(c => (
                        <option key={c.id} value={c.id}>{c.primary ? '📌 ' : ''}{c.summary}</option>
                      ))}
                    </select>
                    <p style={{ color: '#64748b', fontSize: 11, margin: '4px 0 0' }}>Os eventos do bot entram na agenda escolhida.</p>
                  </div>
                )}

                <button onClick={disconnectCalendar} style={{ ...btnDanger, width: '100%' }}>Desconectar</button>
              </div>
            ) : (
              <button onClick={() => { window.location.href = `/api/calendar/auth-url?tenantId=${tenant.id}` }} className="ark-btn-primary" style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Conectar Google Agenda
              </button>
            )}
            {calStatus?.icsUrl && (
              <div style={{ marginTop: 16, background: 'rgba(79,142,247,0.06)', borderRadius: 10, padding: 12 }}>
                <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>📥 Assinar sem OAuth</div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>No Google Agenda: <b>Outras agendas → Adicionar por URL</b> e cole:</div>
                <input readOnly value={calStatus.icsUrl} onClick={e => e.target.select()} style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#94a3b8', fontSize: 10, padding: '6px 8px', fontFamily: 'monospace' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )

  function shiftWeek(delta) {
    const d = new Date(weekAnchor + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setWeekAnchor(d.toISOString().slice(0, 10))
  }
}

function hmLabel(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
