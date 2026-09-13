import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import SectionHelp from '../../components/Tutorial/SectionHelp'


const labelStyle = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

// Definido FORA do ProductModal: se ficasse dentro, o React recriava esse componente
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



const APPT_STATUS = {
  draft:           { label: 'Rascunho',  color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  pending_payment: { label: 'Aguard. pagamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  confirmed:       { label: 'Confirmado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled:       { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  completed:       { label: 'Concluído',  color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' },
}

function StatusChip({ status, map }) {
  const cfg = map[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.15)' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
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

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadAppointments()
    loadServices()
    loadBooking()
    loadCalStatus()
  }, [tenant])

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
      .then(({ data }) => setBooking(data || { tenant_id: tenant.id, days_of_week: '1,2,3,4,5', open_time: '09:00', close_time: '18:00', slot_min: 60, max_days_ahead: 14 }))
  }

  function loadCalStatus() {
    fetch(`/api/calendar/status?tenantId=${tenant.id}`).then(r => r.json()).then(setCalStatus).catch(() => {})
  }

  async function saveBookingCfg() {
    setSavingConfig(true)
    const { tenant_id, days_of_week, open_time, close_time, slot_min, max_days_ahead } = booking
    await supabase.from('booking_settings').upsert({
      tenant_id, days_of_week, open_time, close_time,
      slot_min: parseInt(slot_min, 10) || 60, max_days_ahead: parseInt(max_days_ahead, 10) || 14,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    setSavingConfig(false)
  }

  function toggleSchedDay(idx) {
    const days = new Set((booking.days_of_week || '').split(',').map(Number))
    if (days.has(idx)) days.delete(idx); else days.add(idx)
    if (days.size === 0) return
    setBooking(b => ({ ...b, days_of_week: [...days].sort().join(',') }))
  }

  async function disconnectCalendar() {
    await fetch(`/api/calendar/status?tenantId=${tenant.id}`, { method: 'DELETE' })
    loadCalStatus()
  }

  async function setApptStatus(appt, status) {
    await supabase.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', appt.id)
    loadAppointments()
  }

  const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  const TABS = [
    { id: 'agendamentos', label: '📋 Agendamentos' },
    { id: 'servicos', label: '📅 Serviços' },
    { id: 'horarios', label: '⏰ Horários & Google Agenda' },
  ]

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

      {tab === 'agendamentos' && (
        loadingData ? (
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
              <div key={a.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', minWidth: 64, background: 'rgba(79,142,247,0.08)', borderRadius: 10, padding: '6px 8px' }}>
                  <div style={{ color: '#4f8ef7', fontWeight: 800, fontSize: 13 }}>{fmtDate(a.date)}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{a.start_time}</div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>{a.services?.name || 'Serviço removido'}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{a.customer_name || '—'} · {a.customer_phone} · até {a.end_time}</div>
                </div>
                <StatusChip status={a.status} map={APPT_STATUS} />
                {a.status === 'confirmed' && (
                  <button onClick={() => setApptStatus(a, 'completed')} style={{ background: 'rgba(79,142,247,0.12)', color: '#4f8ef7', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Concluído</button>
                )}
                {(a.status === 'pending_payment' || a.status === 'confirmed') && (
                  <button onClick={() => setApptStatus(a, 'cancelled')} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                )}
                {a.status === 'draft' && (
                  <button onClick={() => setApptStatus(a, 'cancelled')} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Descartar</button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'servicos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Serviços que seus clientes agendam pelo bot — com taxa via PIX pra garantir o compromisso.</p><SectionHelp t='products' s='servicos' />
              <button onClick={() => { setEditingService(null); setShowServiceModal(true) }} className="ark-btn" style={{ whiteSpace: 'nowrap' }}>+ Novo Serviço</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {services.length === 0 && (
                <div style={{ padding: 28, color: '#64748b', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)', fontSize: 13, gridColumn: '1/-1' }}>
                  Nenhum serviço ainda. Crie o primeiro e adicione o bloco 📅 *Agendar* no fluxo do bot.
                </div>
              )}
              {services.map(svc => (
                <div key={svc.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    {svc.image_url && <img src={svc.image_url} alt={svc.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                        {svc.name} {!svc.is_active && <span style={{ color: '#64748b', fontSize: 11 }}>(pausado)</span>}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                        {svc.price > 0 ? `Taxa R$ ${parseFloat(svc.price).toFixed(2)}` : 'Grátis'} · {svc.duration_min} min
                      </div>
                      {svc.description && <div style={{ color: '#64748b', fontSize: 11, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{svc.description}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button onClick={() => supabase.from('services').update({ is_active: !svc.is_active }).eq('id', svc.id).then(loadServices)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 11, cursor: 'pointer' }}>
                      {svc.is_active ? '⏸ Pausar' : '▶ Ativar'}
                    </button>
                    <button onClick={() => { setEditingService(svc); setShowServiceModal(true) }} style={{ flex: 1, background: 'rgba(79,142,247,0.12)', color: '#4f8ef7', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 11, cursor: 'pointer' }}>✏️ Editar</button>
                    <button onClick={() => confirm(`Apagar o serviço "${svc.name}"?`) && supabase.from('services').delete().eq('id', svc.id).then(loadServices)} style={{ flex: 1, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {tab === 'horarios' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div className="ark-card" style={{ padding: 20 }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>⏰ Horários de atendimento<SectionHelp t='products' s='horarios' /></h3>
              {booking && (
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
                    <Field label="DURAÇÃO DO HORÁRIO (min)" name="slot_min" value={booking.slot_min} onChange={(n, v) => setBooking(b => ({ ...b, slot_min: v }))} type="number" hint="60 = agenda de hora em hora." />
                    <Field label="AGENDA ATÉ (dias)" name="max_days_ahead" value={booking.max_days_ahead} onChange={(n, v) => setBooking(b => ({ ...b, max_days_ahead: v }))} type="number" hint="Quantos dias à frente o cliente pode agendar." />
                  </div>
                  <button onClick={saveBookingCfg} disabled={savingConfig} className="ark-btn" style={{ width: '100%' }}>
                    {savingConfig ? 'Salvando…' : 'Salvar horários'}
                  </button>
                </>
              )}
            </div>

            <div className="ark-card" style={{ padding: 20 }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>🔗 Google Agenda<SectionHelp t='products' s='google-agenda' /></h3>
              <p style={{ color: '#475569', fontSize: 12, margin: '0 0 14px' }}>
                Sincronize sua agenda: o bot consulta os horários ocupados do seu Google antes de oferecer slots, e cada agendamento confirmado entra automaticamente no seu calendário.
              </p>
              {calStatus?.connected ? (
                <div>
                  <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>✓ Conectado{calStatus.email ? ` — ${calStatus.email}` : ''}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>Horários do Google bloqueiam automaticamente a agenda do bot.</div>
                  </div>
                  <button onClick={disconnectCalendar} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Desconectar</button>
                </div>
              ) : (
                <button onClick={() => { window.location.href = `/api/calendar/auth-url?tenantId=${tenant.id}` }} className="ark-btn" style={{ width: '100%' }}>
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
}
