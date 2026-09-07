import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

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

export default function AgendamentosPage() {
  const router = useRouter()
  const { user, tenant, loading } = useTenant()
  const [tab, setTab] = useState('agendamentos')

  const [appointments, setAppointments] = useState([])
  const [orders, setOrders] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadData()
  }, [tenant])

  async function loadData() {
    setLoadingData(true)
    const today = new Date().toISOString().slice(0, 10)
    const [appts, ords] = await Promise.all([
      supabase.from('appointments').select('*, services(name, duration_min)').eq('tenant_id', tenant.id).gte('date', today).order('date').order('start_time'),
      supabase.from('whatsapp_orders').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(100),
    ])
    setAppointments(appts.data || [])
    setOrders(ords.data || [])
    setLoadingData(false)
  }

  async function setApptStatus(appt, status) {
    await supabase.from('appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', appt.id)
    loadData()
  }

  const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  const fmtMoney = (v) => `R$ ${parseFloat(v || 0).toFixed(2)}`

  const TABS = [
    { id: 'agendamentos', label: '📅 Agendamentos' },
    { id: 'pedidos', label: '🛍️ Pedidos' },
  ]

  return (
    <AdminLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Agendamentos e Pedidos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Configure serviços e horários no 📦 Catálogo</p>
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
              <br />Cadastre serviços na aba <b>Serviços</b> do Catálogo e adicione o bloco 📅 no fluxo do bot.
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
      ) : (
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
      )}
    </AdminLayout>
  )
}
