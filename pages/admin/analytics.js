import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, usagePercent } from '../../lib/plans'
import SectionHelp from '../../components/Tutorial/SectionHelp'

const CAT = {
  utility:   { label: 'Utility',    icon: '🛠️', color: '#22c55e', price: 0.05, metaPrice: 0.04, desc: 'Confirmações, cobranças e avisos práticos' },
  marketing: { label: 'Marketing',  icon: '📣', color: '#f59e0b', price: 0.36, metaPrice: 0.34, desc: 'Campanhas e divulgação' },
  auth:      { label: 'Autenticação', icon: '🔐', color: '#8b5cf6', price: null, metaPrice: null, desc: 'Códigos de verificação' },
}

const PERIODS = [
  { days: 7,  label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
]

const STAT_COLORS = { open: '#4f8ef7', bot: '#8b5cf6', human: '#f59e0b', closed: '#475569', no_bot: '#64748b' }
const STAT_LABELS = { open: 'Abertas', bot: 'Com bot', human: 'Humano', closed: 'Fechadas', no_bot: 'Sem bot' }

export default function AnalyticsPage() {
  const { user, tenant, role, usage, profile, loading } = useTenant()
  const router = useRouter()
  const [subTab, setSubTab] = useState(router.query.tab || 'overview')
  const [period, setPeriod] = useState(30)
  const [ov, setOv] = useState(null)
  const [loadingOv, setLoadingOv] = useState(false)

  // Dados do modelo de cobrança Meta (sub-aba Conversas Iniciadas)
  const [history, setHistory] = useState([])
  const [credits, setCredits] = useState({ utility: 0, marketing: 0 })
  const [topContacts, setTopContacts] = useState([])

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  const loadOverview = useCallback(async (d) => {
    setLoadingOv(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/analytics/overview?days=${d}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (res.ok) setOv(data)
    } catch (e) { console.error('overview:', e) } finally { setLoadingOv(false) }
  }, [])

  useEffect(() => { if (tenant) loadOverview(period) }, [tenant, period, loadOverview])

  useEffect(() => {
    if (!tenant) return
    // Histórico de uso (cobrança Meta)
    supabase.from('usage').select('*').eq('tenant_id', tenant.id)
      .order('month', { ascending: false }).limit(12)
      .then(({ data }) => setHistory((data || []).reverse()))

    // Créditos de conversas iniciadas (via endpoint — RLS)
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/credits/balance?tenant_id=${tenant.id}`, {
          headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        })
        const data = await res.json()
        if (!data.error) setCredits({ utility: data.utility || 0, marketing: data.marketing || 0 })
      } catch (e) { console.error('credits:', e) }
    })()

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
        setTopContacts(Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5))
      })
  }, [tenant])

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  const plan   = PLANS[tenant.plan] || PLANS.free
  const pct    = usagePercent(tenant, usage)
  const o      = ov?.overview || {}
  const f      = ov?.funnel || { conversations: 0, orders: 0, paymentsCreated: 0, paymentsConfirmed: 0, conversion: 0 }
  const conv   = ov?.conversations || { perDay: [], byHour: new Array(24).fill(0), statusNow: {}, inbound: 0, outbound: 0 }
  const bot    = ov?.bot || {}
  const sales  = ov?.sales || { topProducts: [], topClients: [] }
  const appts  = ov?.appointments || { topServices: [] }
  const clients = ov?.clients || { topClients: [] }
  const hasData = f.conversations > 0

  const biMonth     = Number(usage?.business_initiated_conversations || 0)
  const serviceMsgs  = Number(usage?.service_messages || 0)
  const metaCost     = Number(usage?.meta_cost_brl || 0)
  const maxDay = Math.max(...(conv.perDay.length ? conv.perDay.map(d => d.count) : [1]), 1)
  const maxHour = Math.max(...conv.byHour, 1)
  const brl = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const num = v => Number(v || 0).toLocaleString('pt-BR')

  const SUB_TABS = [
    { key: 'overview',  label: 'Visão Geral',      icon: '📊' },
    { key: 'conversas', label: 'Conversas',        icon: '💬' },
    { key: 'bot',       label: 'Bot',              icon: '🤖' },
    { key: 'vendas',    label: 'Vendas',           icon: '🛒' },
    { key: 'agendamentos', label: 'Agendamentos',  icon: '📅' },
    { key: 'clientes',  label: 'Clientes',         icon: '👥' },
    { key: 'billing',   label: 'Conversas Iniciadas', icon: '💸' },
  ]

  const Section = ({ title, help, children }) => (
    <div className="ark-card" style={{ marginBottom: 16 }}>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>{title}{help}</h3>
      {children}
    </div>
  )

  const StatCard = ({ icon, label, value, sub, color }) => (
    <div className="ark-card" style={{ borderLeft: color ? `3px solid ${color}` : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text-primary)', marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  const FUNNEL_STAGES = [
    { key: 'conversations', label: 'CONVERSAS', color: '#4f8ef7', value: f.conversations },
    { key: 'orders', label: 'PEDIDOS', color: '#8b5cf6', value: f.orders },
    { key: 'paymentsCreated', label: 'PAGAMENTOS INICIADOS', color: '#f59e0b', value: f.paymentsCreated },
    { key: 'paymentsConfirmed', label: 'PAGAMENTOS CONFIRMADOS', color: '#22c55e', value: f.paymentsConfirmed },
  ]

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      {/* Header + período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>📊 Analytics</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>O que está acontecendo com seu negócio — e quanto isso está gerando</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: period === p.days ? '1px solid #4f8ef7' : '1px solid var(--border-soft)',
                background: period === p.days ? '#4f8ef7' : 'transparent',
                color: period === p.days ? '#fff' : '#64748b',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 20 }}>
        {SUB_TABS.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            style={{
              padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
              fontWeight: subTab === st.key ? 700 : 500,
              border: subTab === st.key ? '1px solid #4f8ef7' : '1px solid var(--border-soft)',
              background: subTab === st.key ? '#4f8ef7' : 'var(--bg-card, #fff)',
              color: subTab === st.key ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}>
            {st.icon} {st.label}
          </button>
        ))}
      </div>

      {loadingOv && subTab !== 'billing' && (
        <div style={{ padding: 30, textAlign: 'center', color: '#475569', fontSize: 13 }}>Carregando números do período…</div>
      )}

      {/* ══════════ VISÃO GERAL ══════════ */}
      {!loadingOv && subTab === 'overview' && (
        <div>
          {/* FUNIL DO NEGÓCIO */}
          <div className="ark-card" style={{ marginBottom: 16, border: '1px solid rgba(79,142,247,0.3)' }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🚀 Funil do negócio · últimos {period} dias</h3>
            {!hasData ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 13 }}>
                O funil aparece conforme o bot atender, vender e agendar. Converse com seu número de teste pra ver os dados fluindo.
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 280 }}>
                  {FUNNEL_STAGES.map((st, i) => (
                    <div key={st.key} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {i > 0 && <div style={{ color: '#475569', fontSize: 18, lineHeight: 1.2 }}>↓</div>}
                      <div style={{
                        width: '100%', padding: '12px 16px', borderRadius: 10, textAlign: 'center',
                        border: `1px solid ${st.color}55`, background: `${st.color}10`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: st.color }}>{num(st.value)}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', letterSpacing: 1 }}>{st.label}</span>
                      </div>
                      {i > 0 && f[`conversations`] > 0 && (
                        <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                          {((st.value / Math.max(f.conversations, 1)) * 100).toFixed(1)}% das conversas
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Conversão final: </span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{f.conversion}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cards de visão geral */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon="💬" label={`Conversas (${period}d)`} value={num(o.conversations)} color="#4f8ef7" />
            <StatCard icon="👥" label="Clientes atendidos" value={num(o.clientsAttended)} color="#10b981" />
            <StatCard icon="🤖" label="Atendimentos automatizados" value={num(o.automated)} sub={bot.automatedPct !== null ? `${bot.automatedPct}% do período` : ''} color="#8b5cf6" />
            <StatCard icon="👤" label="Atendimento humano" value={num(o.human)} color="#f59e0b" />
            <StatCard icon="🛒" label="Vendas confirmadas" value={num(o.salesCount)} sub={brl(o.salesBrl)} color="#22c55e" />
            <StatCard icon="📅" label="Agendamentos confirmados" value={num(o.appointmentsConfirmed)} color="#06b6d4" />
            <StatCard icon="✨" label="Novos clientes" value={num(o.newClients)} sub={`recorrentes: ${num(o.recurringClients)}`} color="#e879f9" />
          </div>

          {/* Uso do plano (mensagens) */}
          <Section title={`Uso do plano ${plan.label} este mês`} help={<><SectionHelp t='analytics' s='status' /><SectionHelp t='analytics' s='plano' /></>}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 8 }}>
              <span>{(usage?.messages || 0).toLocaleString('pt-BR')} / {plan.max_messages_month === 999999 ? '∞' : plan.max_messages_month.toLocaleString('pt-BR')} msgs</span>
              <span style={{ fontWeight: 700, color: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981' }}>{pct}%</span>
            </div>
            <div style={{ background: '#12121f', borderRadius: 8, height: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 8,
                background: pct >= 90 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : pct >= 70 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#4f8ef7,#06b6d4)',
                transition: 'width 0.5s ease' }} />
            </div>
            {pct >= 80 && (
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: pct >= 90 ? '#ef4444' : '#f59e0b' }}>{pct >= 90 ? '⚠️ Limite quase atingido!' : '⚡ 80% do limite usado'}</span>
                <button onClick={() => router.push('/admin/upgrade')} className="ark-btn" style={{ padding: '5px 12px', fontSize: 11 }}>Fazer upgrade</button>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ══════════ CONVERSAS ══════════ */}
      {!loadingOv && subTab === 'conversas' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon="📨" label="Recebidas do cliente" value={num(conv.inbound)} color="#4f8ef7" />
            <StatCard icon="📤" label="Enviadas pelo bot" value={num(conv.outbound)} color="#22c55e" />
            <StatCard icon="💬" label="Conversas no período" value={num(o.conversations)} color="#8b5cf6" />
            <StatCard icon="👥" label="Clientes atendidos" value={num(o.clientsAttended)} color="#10b981" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
            <Section title="Conversas por dia">
              {conv.perDay.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#334155', fontSize: 13 }}>Sem conversas no período</div>
              ) : (
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 160 }}>
                  {conv.perDay.map(d => (
                    <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                      <div style={{ width: '100%', height: `${Math.max((d.count / maxDay) * 130, 3)}px`, background: 'linear-gradient(180deg,#4f8ef7,#06b6d4)', borderRadius: '3px 3px 0 0' }} title={`${d.date}: ${d.count}`} />
                      <div style={{ color: '#334155', fontSize: 8 }}>{d.date.slice(8)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Horários de maior movimento">
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 160 }}>
                {conv.byHour.map((c, h) => (
                  <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                    <div style={{ width: '100%', height: `${Math.max((c / maxHour) * 130, 2)}px`, background: c > 0 ? 'linear-gradient(180deg,#22c55e,#10b981)' : 'var(--bg-secondary,#f1f5f9)', borderRadius: '3px 3px 0 0' }} title={`${h}h: ${c} mensagens`} />
                    {h % 6 === 0 && <div style={{ color: '#334155', fontSize: 8 }}>{h}h</div>}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Todas as mensagens do período, por hora do dia — descubra quando sua audiência está online.</div>
            </Section>
          </div>

          <Section title="Status atual das conversas do período">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(conv.statusNow).map(([status, count]) => (
                <div key={status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: STAT_COLORS[status] || '#64748b' }}>{STAT_LABELS[status] || status}</span>
                    <span style={{ color: '#94a3b8', fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ background: '#12121f', borderRadius: 4, height: 6 }}>
                    <div style={{ height: '100%', width: o.conversations ? `${(count / o.conversations) * 100}%` : '0%', background: STAT_COLORS[status] || '#64748b', borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ══════════ BOT ══════════ */}
      {!loadingOv && subTab === 'bot' && (
        <div>
          <div className="ark-card" style={{ marginBottom: 16, textAlign: 'center', padding: 28 }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>🤖 Eficiência do Ark no período</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: bot.automatedPct > 80 ? '#22c55e' : bot.automatedPct > 50 ? '#f59e0b' : '#ef4444' }}>
              {bot.automatedPct !== null ? `${bot.automatedPct}%` : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>dos atendimentos ficaram no bot (não precisaram de humano)</div>
            <div style={{ background: '#12121f', borderRadius: 8, height: 10, marginTop: 16, overflow: 'hidden', maxWidth: 420, margin: '16px auto 0' }}>
              <div style={{ height: '100%', width: `${bot.automatedPct || 0}%`, background: 'linear-gradient(90deg,#22c55e,#10b981)' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon="🤖" label="Atendimentos automatizados" value={num(bot.automated)} color="#22c55e" />
            <StatCard icon="👤" label="Transferidos para humano" value={num(bot.human)} color="#f59e0b" />
          </div>
          <div className="ark-card" style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
            💡 A partir da Fase 2 desta aba, o Ark também vai registrar <b>falhas de fluxo, fallbacks e caminhos mais percorridos</b> — hoje os eventos de bot já começam a ser coletados automaticamente (tabela analytics_events) e as métricas aparecem quando houver massa de dados suficiente.
          </div>
        </div>
      )}

      {/* ══════════ VENDAS ══════════ */}
      {!loadingOv && subTab === 'vendas' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon="🛒" label="Vendas confirmadas" value={num(sales.paidCount)} color="#22c55e" />
            <StatCard icon="💰" label="Faturamento no período" value={brl(sales.paidBrl)} color="#10b981" />
            <StatCard icon="🎫" label="Ticket médio" value={brl(sales.avgTicket)} color="#4f8ef7" />
            <StatCard icon="⏳" label="Pagamentos pendentes" value={num(sales.pending)} color="#f59e0b" />
            <StatCard icon="🚫" label="Cancelados/expirados" value={num(sales.cancelled)} color="#ef4444" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <Section title="🏆 Produtos que mais faturaram">
              {(sales.topProducts || []).length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Nenhuma venda confirmada no período ainda</div>
              ) : sales.topProducts.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 18, fontSize: 12, color: '#334155', textAlign: 'right' }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{p.count} venda{p.count !== 1 ? 's' : ''}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{brl(p.brl)}</span>
                </div>
              ))}
            </Section>
            <Section title="👑 Maiores compradores">
              {(clients.topClients || []).length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Aparecem conforme as vendas forem confirmadas</div>
              ) : clients.topClients.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 18, fontSize: 12, color: '#334155', textAlign: 'right' }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{c.phone || ''}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{brl(c.spent)}</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* ══════════ AGENDAMENTOS ══════════ */}
      {!loadingOv && subTab === 'agendamentos' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon="📅" label="Solicitados" value={num(appts.created)} color="#4f8ef7" />
            <StatCard icon="✅" label="Confirmados" value={num(appts.confirmed)} color="#22c55e" />
            <StatCard icon="❌" label="Cancelados/expirados" value={num(appts.cancelled)} color="#ef4444" />
            <StatCard icon="📈" label="Taxa de conversão" value={appts.conversion !== null && appts.conversion !== undefined ? `${appts.conversion}%` : '—'} color="#f59e0b" />
          </div>
          <Section title="🗓️ Serviços mais agendados">
            {(appts.topServices || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Nenhum agendamento no período — cadastre serviços na aba Agendamentos e ofereça-os no bot</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {appts.topServices.map((s, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>{s.count}</span>
                    </div>
                    <div style={{ background: '#12121f', borderRadius: 4, height: 6 }}>
                      <div style={{ height: '100%', width: `${(s.count / Math.max(...(appts.topServices || []).map(x => x.count), 1)) * 100}%`, background: 'linear-gradient(90deg,#4f8ef7,#06b6d4)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ══════════ CLIENTES ══════════ */}
      {!loadingOv && subTab === 'clientes' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard icon="✨" label="Novos clientes" value={num(clients.newCount)} sub={`nos últimos ${period} dias`} color="#22c55e" />
            <StatCard icon="🔁" label="Clientes recorrentes" value={num(clients.recurringCount)} sub="2+ conversas no período" color="#8b5cf6" />
            <StatCard icon="👥" label="Clientes atendidos" value={num(o.clientsAttended)} color="#4f8ef7" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <Section title="🏆 Contatos mais ativos" help={<SectionHelp t='analytics' s='contatos' />}>
              {topContacts.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Sem conversas ainda</div>
              ) : topContacts.map(({ contact, count }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 18, fontSize: 12, color: '#334155', textAlign: 'right' }}>{i + 1}.</span>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {(contact?.name || contact?.phone || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{contact?.name || contact?.phone || 'Desconhecido'}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{contact?.phone}</div>
                  </div>
                  <span className="ark-badge ark-badge-blue">{count} conversa{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </Section>
            <Section title="👑 Maiores compradores">
              {(clients.topClients || []).length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Aparecem conforme as vendas forem confirmadas</div>
              ) : clients.topClients.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-soft)' }}>
                  <span style={{ width: 18, fontSize: 12, color: '#334155', textAlign: 'right' }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{c.phone || ''} · {c.purchases} compra{c.purchases !== 1 ? 's' : ''}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{brl(c.spent)}</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}

      {/* ══════════ CONVERSAS INICIADAS (cobrança Meta) ══════════ */}
      {subTab === 'billing' && (
        <div>
          <div className="ark-card" style={{ marginBottom: 16, border: '1px solid rgba(79,142,247,0.25)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>💸 Como a Meta cobra pelo WhatsApp Business</div>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
              Desde julho/2025, a cobrança é <b>por conversa iniciada pela empresa</b> — não por mensagem. Quando o cliente manda mensagem primeiro, você tem uma janela de 24h <b>grátis</b> (service). Fora dela, cada conversa que a empresa inicia é cobrada por categoria. A Arkiel repassa isso em <b>créditos pré-pagos</b>: 1 crédito = 1 conversa iniciada.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-secondary, #f1f5f9)', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                💬 <b style={{ color: '#22c55e' }}>Service — grátis:</b> o cliente inicia a conversa e você responde dentro de 24h. Todas as mensagens do bot dentro da janela não geram custo.
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-secondary, #f1f5f9)', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                🛡️ <b style={{ color: '#4f8ef7' }}>Proteção Arkiel:</b> se a janela expirar, o bot usa template aprovado — e o envio só sai se houver crédito da categoria certa.
              </div>
            </div>
          </div>

          {/* Categorias do mês */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
            {Object.entries(CAT).map(([key, c]) => {
              const count = Number(usage?.[`${key}_conversations`] || 0)
              return (
                <div key={key} className="ark-card" style={{ borderLeft: `3px solid ${c.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.icon} {c.label}</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{c.price ? `R$ ${c.price.toFixed(2)}/conv.` : key === 'auth' ? 'cobrada por conversa' : ''}</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{count.toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{c.desc}</div>
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>
                    {count > 0 && c.metaPrice ? `≈ R$ ${(count * c.metaPrice).toFixed(2)} de custo Meta` : count > 0 ? 'consumo no mês' : 'sem uso este mês'}
                  </div>
                </div>
              )
            })}
            <div className="ark-card" style={{ borderLeft: '3px solid #22c55e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>💬 Service</span>
                <span style={{ fontSize: 11, color: '#22c55e' }}>grátis</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{serviceMsgs.toLocaleString('pt-BR')}</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>mensagens dentro da janela de 24h do cliente</div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>quanto mais aqui, menos você paga 💚</div>
            </div>
          </div>

          {/* Créditos */}
          <div className="ark-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>🎟️ Créditos de conversas iniciadas</h3>
              <button onClick={() => router.push('/admin/marketing')} className="ark-btn" style={{ padding: '6px 14px', fontSize: 11 }}>Comprar créditos</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary, #f1f5f9)' }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>🛠️ Utility · R$0,05/crédito</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{(credits.utility || 0).toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>R$0,04 Meta + R$0,01 Arkiel</div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary, #f1f5f9)' }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>📣 Marketing · R$0,36/crédito</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{(credits.marketing || 0).toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>R$0,34 Meta + R$0,02 Arkiel</div>
              </div>
            </div>
          </div>

          {/* Histórico mensal */}
          <div className="ark-card">
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 10 }}>📜 Histórico por mês<SectionHelp t='analytics' s='mensagens' /></h3>
            {history.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Sem histórico ainda</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#475569', fontSize: 11 }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Mês</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Iniciadas</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Utility</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Marketing</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Auth</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Service (grátis)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--border-soft)' }}>Custo Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map(s => {
                      const bi = Number(s.business_initiated_conversations || 0)
                      return (
                        <tr key={s.month}>
                          <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>{s.month.slice(5)}/{s.month.slice(2, 4)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#4f8ef7', fontWeight: 700 }}>{bi > 0 ? bi.toLocaleString('pt-BR') : '—'}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#22c55e' }}>{Number(s.utility_conversations || 0) > 0 ? Number(s.utility_conversations) : '—'}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#f59e0b' }}>{Number(s.marketing_conversations || 0) > 0 ? Number(s.marketing_conversations) : '—'}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#8b5cf6' }}>{Number(s.auth_conversations || 0) > 0 ? Number(s.auth_conversations) : '—'}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#64748b' }}>{Number(s.service_messages || 0).toLocaleString('pt-BR')}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: Number(s.meta_cost_brl || 0) > 0 ? '#ef4444' : '#475569', fontWeight: 600 }}>
                            {Number(s.meta_cost_brl || 0) > 0 ? `R$ ${Number(s.meta_cost_brl).toFixed(2)}` : 'R$ 0,00'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
