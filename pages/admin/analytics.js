import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, usagePercent } from '../../lib/plans'

export default function AnalyticsPage() {
  const { user, tenant, role, usage, loading } = useTenant()
  const router = useRouter()
  const [history, setHistory] = useState([])
  const [topContacts, setTopContacts] = useState([])
  const [convStats, setConvStats] = useState({ open: 0, bot: 0, human: 0, closed: 0 })

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    // Histórico de uso (últimos 12 meses)
    supabase.from('usage').select('*').eq('tenant_id', tenant.id)
      .order('month', { ascending: false }).limit(12)
      .then(({ data }) => setHistory((data || []).reverse()))

    // Contatos com mais conversas
    supabase.from('conversations')
      .select('contact_id, contacts(name, phone)')
      .eq('tenant_id', tenant.id)
      .limit(200)
      .then(({ data }) => {
        if (!data) return
        const counts = {}
        data.forEach(c => {
          const key = c.contact_id
          if (!counts[key]) counts[key] = { contact: c.contacts, count: 0 }
          counts[key].count++
        })
        const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5)
        setTopContacts(sorted)
      })

    // Status das conversas
    supabase.from('conversations').select('status').eq('tenant_id', tenant.id)
      .then(({ data }) => {
        if (!data) return
        const s = { open: 0, bot: 0, human: 0, closed: 0 }
        data.forEach(c => { s[c.status] = (s[c.status] || 0) + 1 })
        setConvStats(s)
      })
  }, [tenant])

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  const plan    = PLANS[tenant.plan] || PLANS.free
  const pct     = usagePercent(tenant, usage)
  const maxMsg  = Math.max(...history.map(s => s.messages), 1)
  const total   = Object.values(convStats).reduce((a, b) => a + b, 0)

  const CONV_COLORS = { open: '#4f8ef7', bot: '#8b5cf6', human: '#f59e0b', closed: '#475569' }
  const CONV_LABELS = { open: 'Abertas', bot: 'Com bot', human: 'Humano', closed: 'Fechadas' }

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>📊 Analytics</h1>
        <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Visão geral do uso e desempenho</p>
      </div>

      {/* Cards de uso */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Mensagens este mês', value: (usage?.messages || 0).toLocaleString('pt-BR'), icon: '💬', color: '#4f8ef7' },
          { label: 'Conversas este mês', value: (usage?.conversations || 0).toLocaleString('pt-BR'), icon: '🗂', color: '#8b5cf6' },
          { label: 'Total de conversas', value: total.toLocaleString('pt-BR'), icon: '📁', color: '#10b981' },
          { label: 'Limite do plano', value: `${pct}%`, icon: '⚡', color: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981' },
        ].map(s => (
          <div key={s.label} className="ark-card">
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Uso do plano */}
      <div className="ark-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Uso do plano {plan.label} este mês</h3>
          <span style={{ fontSize: 12, color: '#475569' }}>
            {(usage?.messages || 0).toLocaleString('pt-BR')} / {plan.max_messages_month === 999999 ? '∞' : plan.max_messages_month.toLocaleString('pt-BR')} msgs
          </span>
        </div>
        <div style={{ background: '#12121f', borderRadius: 8, height: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 8,
            background: pct >= 90 ? 'linear-gradient(90deg,#ef4444,#dc2626)' :
                        pct >= 70 ? 'linear-gradient(90deg,#f59e0b,#d97706)' :
                                    'linear-gradient(90deg,#4f8ef7,#06b6d4)',
            transition: 'width 0.5s ease' }} />
        </div>
        {pct >= 80 && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: pct >= 90 ? '#ef4444' : '#f59e0b' }}>
              {pct >= 90 ? '⚠️ Limite quase atingido!' : '⚡ 80% do limite usado'}
            </span>
            <button onClick={() => router.push('/admin/upgrade')} className="ark-btn" style={{ padding: '5px 12px', fontSize: 11 }}>
              Fazer upgrade
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Gráfico de barras */}
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Mensagens por mês</h3>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
              Dados aparecerão conforme o bot for usado
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 180 }}>
              {history.map(s => {
                const h = Math.max((s.messages / maxMsg) * 150, 4)
                return (
                  <div key={s.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{ color: '#4f8ef7', fontSize: 10, fontWeight: 700 }}>{s.messages}</div>
                    <div style={{ width: '100%', height: `${h}px`, background: 'linear-gradient(180deg,#4f8ef7,#06b6d4)', borderRadius: '4px 4px 0 0' }} />
                    <div style={{ color: '#334155', fontSize: 9, whiteSpace: 'nowrap' }}>
                      {s.month.slice(5)}/{s.month.slice(2, 4)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Status das conversas */}
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Status das conversas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(convStats).map(([status, count]) => (
              <div key={status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: CONV_COLORS[status] }}>{CONV_LABELS[status]}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 700 }}>{count}</span>
                </div>
                <div style={{ background: '#12121f', borderRadius: 4, height: 6 }}>
                  <div style={{ height: '100%', width: total ? `${(count / total) * 100}%` : '0%',
                    background: CONV_COLORS[status], borderRadius: 4, transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top contatos */}
      {topContacts.length > 0 && (
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>🏆 Contatos mais ativos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topContacts.map(({ contact, count }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 20, fontSize: 12, color: '#334155', textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {(contact?.name || contact?.phone || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{contact?.name || contact?.phone || 'Desconhecido'}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{contact?.phone}</div>
                </div>
                <span className="ark-badge ark-badge-blue">{count} conversa{count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
