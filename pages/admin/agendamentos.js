import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

const labelStyle = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

// Definido FORA do modal — evita remount e perda de foco a cada tecla
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

const DAYS = [
  { idx: 0, label: 'Dom' }, { idx: 1, label: 'Seg' }, { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' }, { idx: 4, label: 'Qui' }, { idx: 5, label: 'Sex' }, { idx: 6, label: 'Sáb' },
]

const APPT_STATUS = {
  draft:           { label: 'Rascunho',  color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  pending_payment: { label: 'Aguard. pagamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  confirmed:       { label: 'Confirmado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  cancelled:       { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  completed:       { label: 'Concluído',  color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' },
}

const ORDER_STATUS = {
  pending:         { label: 'Aguard. pagamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  paid:            { label: 'Pago',        color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  payment_failed:  { label: 'Falhou',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled:       { label: 'Cancelado',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

function StatusChip({ status, map }) {
  const cfg = map[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.15)' }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function ServiceModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price ?? '',
    duration_min: service?.duration_min ?? 60,
    is_active: service?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const setField = useCallback((name, value) => setForm(f => ({ ...f, [name]: value })), [])

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      ...form,
      price: form.price === '' ? 0 : parseFloat(form.price),
      duration_min: parseInt(form.duration_min, 10) || 60,
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>{service ? 'Editar Serviço' : 'Novo Serviço'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <Field label="NOME DO SERVIÇO" name="name" value={form.name} onChange={setField} placeholder="Ex: Consultoria inicial" hint="Como aparece no menu do bot quando o cliente escolhe 📅 Agendar." />
        <Field label="DESCRIÇÃO" name="description" value={form.description} onChange={setField} placeholder="O que está incluído no atendimento" textarea />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="TAXA DE AGENDAMENTO (R$)" name="price" value={form.price} onChange={setField} type="number" placeholder="0.00" hint="0 = agendamento grátis. Cobrado via PIX antes de confirmar." />
          <Field label="DURAÇÃO (min)" name="duration_min" value={form.duration_min} onChange={setField} type="number" placeholder="60" hint="Define o tamanho do horário na agenda." />
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

export default function AgendamentosPage() {
  const router = useRouter()
  const { user, tenant, loading } = useTenant()
  const [tab, setTab] = useState('agendamentos') // agendamentos | pedidos | config

  const [appointments, setAppointments] = useState([])
  const [orders, setOrders] = useState([])
  const [services, setServices] = useState([])
  const [booking, setBooking] = useState(null)
  const [loadingData, setLoadingData] = useState(true)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadData()
  }, [tenant])

  async function loadData() {
    setLoadingData(true)
    const today = new Date().toISOString().slice(0, 10)
    const [appts, ords, svcs, cfg] = await Promise.all([
      supabase.from('appointments').select('*, services(name, duration_min)').eq('tenant_id', tenant.id).gte('date', today).order('date').order('start_time'),
      supabase.from('whatsapp_orders').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(100),
      supabase.from('services').select('*').eq('tenant_id', tenant.id).order('created_at'),
      supabase.from('booking_settings').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    ])
    setAppointments(appts.data || [])
    setOrders(ords.data || [])
    setServices(svcs.data || [])
    setBooking(cfg.data || {
      tenant_id: tenant.id, days_of_week: '1,2,3,4,5', open_time: '09:00',
      close_time: '18:00', slot_min: 60, max_days_ahead: 14,
    })
    setLoadingData(false)
  }

  async function saveService(form) {
    if (editingService) {
      await supabase.from('services').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingService.id)
    } else {
      await supabase.from('services').insert({ ...form, tenant_id: tenant.id })
    }
    setShowServiceModal(false)
    setEditingService(null)
    loadData()
  }

  async function toggleService(svc) {
    await supabase.from('services').update({ is_active: !svc.is_active }).eq('id', svc.id)
    loadData()
  }

  async function deleteService(svc) {
    if (!confirm(`Apagar o serviço "${svc.name}"?`)) return
    await supabase.from('services').delete().eq('id', svc.id)
    loadData()
  }

  async function setApptStatus(appt, status) {
    await supabase.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', appt.id)
    loadData()
  }

  async function saveBooking() {
    setSavingConfig(true)
    const { tenant_id, days_of_week, open_time, close_time, slot_min, max_days_ahead } = booking
    await supabase.from('booking_settings').upsert({
      tenant_id, days_of_week, open_time, close_time,
      slot_min: parseInt(slot_min, 10) || 60, max_days_ahead: parseInt(max_days_ahead, 10) || 14,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    setSavingConfig(false)
  }

  const toggleDay = (idx) => {
    const days = new Set((booking.days_of_week || '').split(',').map(Number))
    if (days.has(idx)) days.delete(idx); else days.add(idx)
    if (days.size === 0) return
    setBooking(b => ({ ...b, days_of_week: [...days].sort().join(',') }))
  }

  const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`

  const TABS = [
    { id: 'agendamentos', label: '📅 Agendamentos' },
    { id: 'pedidos', label: '🛍️ Pedidos' },
    { id: 'config', label: '⚙️ Serviços & Horários' },
  ]

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Agendamentos e Pedidos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Serviços agendáveis pelo bot + pedidos do catálogo WhatsApp</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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

      {loadingData ? (
        <p style={{ color: '#64748b' }}>Carregando…</p>
      ) : tab === 'agendamentos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appointments.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>📅</div>
              Nenhum agendamento futuro.
              <br />Adicione serviços na aba <b>Serviços &amp; Horários</b> e um bloco 📅 no fluxo do bot.
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
      ) : tab === 'pedidos' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🛍️</div>
              Nenhum pedido ainda. Pedidos chegam aqui quando o cliente finaliza o carrinho do catálogo no WhatsApp.
            </div>
          )}
          {orders.map(o => (
            <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>Pedido {String(o.id).slice(0, 8)}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  {new Date(o.created_at).toLocaleString('pt-BR')} · {o.items?.length || 0} item(ns) · {fmtMoney(o.total)}
                </div>
              </div>
              <StatusChip status={o.status} map={ORDER_STATUS} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {/* Serviços */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: 0 }}>Serviços</h2>
              <button onClick={() => { setEditingService(null); setShowServiceModal(true) }}
                style={{ background: 'var(--accent, #22c55e)', color: '#0d0d1a', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Novo serviço
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {services.length === 0 && (
                <div style={{ padding: 24, color: '#64748b', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)', fontSize: 13 }}>
                  Nenhum serviço cadastrado. Crie um e adicione o bloco 📅 no fluxo do bot.
                </div>
              )}
              {services.map(svc => (
                <div key={svc.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                        {svc.name} {!svc.is_active && <span style={{ color: '#64748b', fontSize: 11 }}>(pausado)</span>}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>
                        {fmtMoney(svc.price)} · {svc.duration_min} min
                      </div>
                    </div>
                    <button onClick={() => toggleService(svc)} style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}>
                      {svc.is_active ? '⏸ Pausar' : '▶ Ativar'}
                    </button>
                    <button onClick={() => { setEditingService(svc); setShowServiceModal(true) }} style={{ background: 'rgba(79,142,247,0.12)', color: '#4f8ef7', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => deleteService(svc)} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Horários */}
          <div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Horários de atendimento</h2>
            {booking && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 18 }}>
                <label style={labelStyle}>DIAS QUE ATENDE</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {DAYS.map(d => {
                    const on = (booking.days_of_week || '').split(',').map(Number).includes(d.idx)
                    return (
                      <button key={d.idx} type="button" onClick={() => toggleDay(d.idx)}
                        style={{
                          width: 44, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          background: on ? 'var(--accent, #22c55e)' : 'rgba(255,255,255,0.05)',
                          color: on ? '#0d0d1a' : '#94a3b8',
                        }}>{d.label}</button>
                    )
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="ABRE ÀS" name="open_time" value={booking.open_time} onChange={(n, v) => setBooking(b => ({ ...b, open_time: v }))} type="time" />
                  <Field label="FECHA ÀS" name="close_time" value={booking.close_time} onChange={(n, v) => setBooking(b => ({ ...b, close_time: v }))} type="time" />
                  <Field label="DURAÇÃO DO HORÁRIO (min)" name="slot_min" value={booking.slot_min} onChange={(n, v) => setBooking(b => ({ ...b, slot_min: v }))} type="number" hint="60 = agenda de hora em hora." />
                  <Field label="AGENDA ATÉ (dias)" name="max_days_ahead" value={booking.max_days_ahead} onChange={(n, v) => setBooking(b => ({ ...b, max_days_ahead: v }))} type="number" hint="Quantos dias à frente o cliente pode agendar." />
                </div>
                <button onClick={saveBooking} disabled={savingConfig}
                  style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: 'var(--accent, #22c55e)', color: '#0d0d1a' }}>
                  {savingConfig ? 'Salvando…' : 'Salvar horários'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showServiceModal && (
        <ServiceModal service={editingService} onClose={() => { setShowServiceModal(false); setEditingService(null) }} onSave={saveService} />
      )}
    </AdminLayout>
  )
}
