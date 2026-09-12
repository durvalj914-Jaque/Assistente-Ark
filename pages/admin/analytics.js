import { useEffect, useState } from 'react'
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

export default function AnalyticsPage() {
  const { user, tenant, role, usage, profile, loading } = useTenant()
  const router = useRouter()
  const [subTab, setSubTab] = useState(router.query.tab || 'overview')
  const [history, setHistory] = useState([])
  const [topContacts, setTopContacts] = useState([])
  const [convStats, setConvStats] = useState({ open: 0, bot: 0, human: 0, closed: 0 })
  const [credits, setCredits] = useState({ utility: 0, marketing: 0 })

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

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
  }, [tenant])

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  const plan    = PLANS[tenant.plan] || PLANS.free
  const pct     = usagePercent(tenant, usage)
  const maxMsg  = Math.max(...history.map(s => s.messages), 1)
  const total   = Object.values(convStats).reduce((a, b) => a + b, 0)

  const biMonth     = Number(usage?.business_initiated_conversations || 0)
  const serviceMsgs = Number(usage?.service_messages || 0)
  const metaCost    = Number(usage?.meta_cost_brl || 0)
  const maxBI       = Math.max(...history.map(s => Number(s.business_initiated_conversations || 0)), 1)

  const CONV_COLORS = { open: '#4f8ef7', bot: '#8b5cf6', human: '#f59e0b', closed: '#475569' }
  const CONV_LABELS = { open: 'Abertas', bot: 'Com bot', human: 'Humano', closed: 'Fechadas' }

  const SUB_TABS = [
    { key: 'overview',   label: 'Visão Geral',      icon: '📊', desc: 'Uso e desempenho' },
    { key: 'conversas',  label: 'Conversas Iniciadas', icon: '💸', desc: 'Modelo de cobrança da Meta' },
  ]

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>📊 Analytics</h1>
        <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Visão geral do uso e desempenho</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {SUB_TABS.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            style={{
              flex: 1, padding: '14px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 14,
              fontWeight: subTab === st.key ? 700 : 500,
              border: subTab === st.key ? '1px solid #4f8ef7' : '1px solid var(--border-soft)',
              background: subTab === st.key ? '#4f8ef7' : 'var(--bg-card, #fff)',
              color: subTab === st.key ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{st.icon}</div>
            <div>{st.label}</div>
            <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{st.desc}</div>
          </button>
        ))}
      </div>

      {/* ══════════════ SUB-TABA: VISÃO GERAL ══════════════ */}
      {subTab === 'overview' && (
        <div>
          {/* Cards de uso */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Conversas Iniciadas (mês)', value: biMonth.toLocaleString('pt-BR'), icon: '📤', color: '#4f8ef7' },
              { label: 'Mensagens Service (grátis)', value: serviceMsgs.toLocaleString('pt-BR'), icon: '💬', color: '#22c55e' },
              { label: 'Custo Meta (mês)', value: `R$ ${metaCost.toFixed(2)}`, icon: '💸', color: '#f59e0b' },
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
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>Uso do plano {plan.label} este mês<SectionHelp t='analytics' s='status' /><SectionHelp t='analytics' s='plano' /></h3>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
            {/* Gráfico de barras: mensagens */}
            <div className="ark-card">
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Mensagens por mês<SectionHelp t='analytics' s='mensagens' /></h3>
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

            {/* Gráfico de barras: conversas iniciadas */}
            <div className="ark-card">
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Conversas iniciadas por mês</h3>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
                  Aparecerá conforme você enviar mensagens fora da janela de 24h
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 180 }}>
                  {history.map(s => {
                    const bi = Number(s.business_initiated_conversations || 0)
                    const h = Math.max((bi / maxBI) * 150, 4)
                    return (
                      <div key={s.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                        <div style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>{bi > 0 ? `R$ ${Number(s.meta_cost_brl || 0).toFixed(2)}` : ''}</div>
                        <div style={{ width: '100%', height: `${h}px`, background: bi > 0 ? 'linear-gradient(180deg,#22c55e,#10b981)' : 'var(--bg-secondary, #f1f5f9)', borderRadius: '4px 4px 0 0' }} />
                        <div style={{ color: '#334155', fontSize: 9, whiteSpace: 'nowrap' }}>
                          {s.month.slice(5)}/{s.month.slice(2, 4)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>Valor no topo = custo Meta do mês. Sem barras verdes = só conversas grátis (janela do cliente).</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
            {/* Status das conversas */}
            <div className="ark-card">
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Status das conversas</h3>
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

            {/* Top contatos */}
            <div className="ark-card">
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>🏆 Contatos mais ativos<SectionHelp t='analytics' s='contatos' /></h3>
              {topContacts.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 13 }}>Sem conversas ainda</div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ SUB-TABA: CONVERSAS INICIADAS ══════════════ */}
      {subTab === 'conversas' && (
        <div>
          {/* Explicação do modelo */}
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
              <button onClick={() => router.push('/admin/marketing')} className="ark-btn" style={{ padding: '6px 14px', fontSize: 11 }}>
                Comprar créditos
              </button>
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
            <div style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>
              O webhook debita 1 crédito automaticamente quando abre uma nova janela business-initiated. Sem crédito da categoria → o envio não sai e ninguém paga por engano.
            </div>
          </div>

          {/* Histórico mensal */}
          <div className="ark-card">
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14, marginBottom: 10 }}>📜 Histórico por mês</h3>
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
