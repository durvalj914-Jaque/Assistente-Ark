/**
 * /client — Portal do Cliente
 * Acesso liberado apenas após pagamento de plano ativo
 * Mostra: conversas, mensagens em tempo real, status do bot
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'
import { PLANS, isPlanActive } from '../../lib/plans'
import Head from 'next/head'
import Link from 'next/link'

// ── Paywall ─────────────────────────────────────────────────
function Paywall({ tenant, onRefresh }) {
  const plans = [
    { key: 'starter', ...PLANS.starter },
    { key: 'pro',     ...PLANS.pro },
    { key: 'enterprise', ...PLANS.enterprise }
  ]
  return (
    <div style={styles.paywallRoot}>
      <div style={styles.paywallCard}>
        <img src="/arkiel-logo.png" alt="Arkiel" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 20 }} />
        <div style={styles.paywallBadge}>⚡ Acesso Premium</div>
        <h2 style={styles.paywallTitle}>Ative seu plano para continuar</h2>
        <p style={styles.paywallSub}>
          Seu plano <strong style={{ color: '#fff' }}>{tenant?.plan || 'free'}</strong> não inclui o Portal do Cliente.
          Escolha um plano abaixo e desbloqueie o acesso completo.
        </p>
        <div style={styles.paywallPlans}>
          {plans.map(p => (
            <div key={p.key} style={{ ...styles.paywallPlan, ...(p.key === 'pro' ? styles.paywallPlanFeatured : {}) }}>
              {p.key === 'pro' && <div style={styles.paywallPlanBadge}>Mais popular</div>}
              <div style={styles.paywallPlanName}>{p.label}</div>
              <div style={styles.paywallPlanPrice}>
                {p.price ? `R$ ${(p.price/100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/mês` : 'Consultar'}
              </div>
              <ul style={styles.paywallFeatures}>
                {p.features.map(f => <li key={f} style={styles.paywallFeat}>✓ {f}</li>)}
              </ul>
              <a
                href={`https://play.google.com/store/apps/details?id=com.arkiel.assistenteark`}
                target="_blank" rel="noreferrer"
                style={{ ...styles.paywallBtn, ...(p.key === 'pro' ? styles.paywallBtnPrimary : styles.paywallBtnGhost) }}
              >
                {p.price ? 'Assinar via Google Play' : 'Falar com vendas'}
              </a>
            </div>
          ))}
        </div>
        <p style={styles.paywallNote}>
          Após o pagamento, clique em{' '}
          <button onClick={onRefresh} style={styles.paywallRefresh}>Verificar acesso</button>
          {' '}para liberar automaticamente.
        </p>
      </div>
    </div>
  )
}

// ── Portal principal ─────────────────────────────────────────
export default function ClientPortal() {
  const router  = useRouter()
  const [user, setUser]       = useState(null)
  const [tenant, setTenant]   = useState(null)
  const [bots, setBots]       = useState([])
  const [convs, setConvs]     = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('conversations') // conversations | bots | usage
  const [usage, setUsage]     = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) load(session.user)
      else router.replace('/login')
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    // Realtime: novas mensagens
    const ch = supabase.channel(`conv-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selected.id}`
      }, payload => {
        setMessages(m => [...m, payload.new])
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [selected])

  async function load(u) {
    setUser(u)
    const { data: mem } = await supabase
      .from('tenant_members').select('role, tenants(*)')
      .eq('user_id', u.id).maybeSingle()

    if (!mem?.tenants) { setLoading(false); return }
    const t = mem.tenants
    setTenant(t)

    const month = new Date().toISOString().slice(0,7)
    const [{ data: botData }, { data: convData }, { data: usageData }] = await Promise.all([
      supabase.from('bots').select('*').eq('tenant_id', t.id).order('created_at'),
      supabase.from('conversations')
        .select('*, contacts(name,phone), bots(name)')
        .eq('tenant_id', t.id)
        .order('last_message_at', { ascending: false })
        .limit(60),
      supabase.from('usage').select('*').eq('tenant_id', t.id).eq('month', month).maybeSingle()
    ])
    setBots(botData || [])
    setConvs(convData || [])
    setUsage(usageData || { messages: 0, conversations: 0 })
    setLoading(false)
  }

  async function selectConv(conv) {
    setSelected(conv)
    const { data } = await supabase.from('messages').select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true }).limit(100)
    setMessages(data || [])
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 150)
  }

  if (loading) return (
    <div style={styles.loadingScreen}>
      <img src="/arkiel-logo.png" style={{ width: 44, opacity: 0.7 }} alt="" />
      <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: 16, fontSize: 13 }}>Carregando portal…</p>
    </div>
  )

  // Paywall: plano free ou sem plano
  if (!isPlanActive(tenant) || tenant?.plan === 'free') {
    return <Paywall tenant={tenant} onRefresh={() => { setLoading(true); load(user) }} />
  }

  const plan     = PLANS[tenant?.plan] || PLANS.free
  const usagePct = Math.min(Math.round(((usage?.messages||0) / plan.max_messages_month) * 100), 100)
  const filteredConvs = convs.filter(c =>
    !search || (c.contacts?.name || c.contacts?.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Head><title>Portal do Cliente — Arkiel</title></Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #fff; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
      <div style={styles.root}>

        {/* SIDEBAR */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTop}>
            <Link href="/" style={styles.logoWrap}>
              <img src="/arkiel-logo.png" alt="Arkiel" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span style={styles.logoText}>Arkiel</span>
            </Link>
            <div style={styles.planBadge}>
              <span style={{ ...styles.planDot, background: tenant.status === 'active' ? '#22c55e' : '#ef4444' }} />
              {plan.label}
            </div>
          </div>

          <nav style={styles.nav}>
            {[
              { key: 'conversations', icon: '💬', label: 'Conversas', count: convs.length },
              { key: 'bots',          icon: '🤖', label: 'Meus Bots', count: bots.length },
              { key: 'usage',         icon: '📊', label: 'Uso & Plano' }
            ].map(n => (
              <button key={n.key} onClick={() => setTab(n.key)}
                style={{ ...styles.navItem, ...(tab === n.key ? styles.navItemActive : {}) }}>
                <span style={styles.navIcon}>{n.icon}</span>
                <span style={styles.navLabel}>{n.label}</span>
                {n.count !== undefined && <span style={styles.navCount}>{n.count}</span>}
              </button>
            ))}
          </nav>

          <button onClick={() => supabase.auth.signOut().then(() => router.replace('/login'))}
            style={styles.logoutBtn}>
            ← Sair
          </button>
        </aside>

        {/* MAIN */}
        <main style={styles.main}>

          {/* ── TAB: Conversas ── */}
          {tab === 'conversations' && (
            <div style={styles.chatLayout}>
              {/* Lista */}
              <div style={styles.convList}>
                <div style={styles.convListHeader}>
                  <h2 style={styles.sectionTitle}>Conversas</h2>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar contato…" style={styles.searchInput} />
                </div>
                <div style={styles.convItems}>
                  {filteredConvs.length === 0 && (
                    <div style={styles.emptyState}>Nenhuma conversa encontrada</div>
                  )}
                  {filteredConvs.map(c => (
                    <div key={c.id} onClick={() => selectConv(c)}
                      style={{ ...styles.convItem, ...(selected?.id === c.id ? styles.convItemActive : {}) }}>
                      <div style={styles.convAvatar}>
                        {(c.contacts?.name || c.contacts?.phone || '?')[0].toUpperCase()}
                      </div>
                      <div style={styles.convInfo}>
                        <div style={styles.convName}>{c.contacts?.name || c.contacts?.phone || 'Desconhecido'}</div>
                        <div style={styles.convLast}>{c.last_message || '…'}</div>
                      </div>
                      <div style={styles.convMeta}>
                        <span style={{ ...styles.statusDot,
                          background: c.status === 'human' ? '#f59e0b'
                            : c.status === 'bot' ? '#4f8ef7'
                            : c.status === 'closed' ? '#374151' : '#22c55e' }} />
                        <div style={styles.convTime}>
                          {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat */}
              <div style={styles.chatArea}>
                {!selected ? (
                  <div style={styles.chatPlaceholder}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>Selecione uma conversa</p>
                  </div>
                ) : (
                  <>
                    <div style={styles.chatHeader}>
                      <div style={styles.convAvatar}>{(selected.contacts?.name || '?')[0].toUpperCase()}</div>
                      <div>
                        <div style={styles.chatHeaderName}>{selected.contacts?.name || selected.contacts?.phone}</div>
                        <div style={styles.chatHeaderSub}>📱 {selected.contacts?.phone} · Bot: {selected.bots?.name}</div>
                      </div>
                      <span style={{ ...styles.statusBadge,
                        background: selected.status === 'human' ? 'rgba(245,158,11,0.15)' : 'rgba(79,142,247,0.15)',
                        color: selected.status === 'human' ? '#f59e0b' : '#4f8ef7',
                        border: `1px solid ${selected.status === 'human' ? 'rgba(245,158,11,0.3)' : 'rgba(79,142,247,0.3)'}`,
                        marginLeft: 'auto'
                      }}>
                        {selected.status === 'human' ? '👤 Humano' : '🤖 Bot'}
                      </span>
                    </div>
                    <div style={styles.chatMessages}>
                      {messages.map(m => (
                        <div key={m.id} style={{ ...styles.msgWrapper, justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                          <div style={{ ...styles.msgBubble,
                            background: m.direction === 'outbound' ? 'rgba(79,142,247,0.2)' : 'rgba(255,255,255,0.06)',
                            borderBottomRightRadius: m.direction === 'outbound' ? 4 : 14,
                            borderBottomLeftRadius:  m.direction === 'inbound'  ? 4 : 14,
                          }}>
                            {m.content}
                            <div style={styles.msgTime}>
                              {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={endRef} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Bots ── */}
          {tab === 'bots' && (
            <div style={styles.tabContent}>
              <h2 style={styles.sectionTitle}>Meus Bots</h2>
              <p style={styles.sectionSub}>Gerencie os bots conectados à sua conta WhatsApp Business.</p>
              <div style={styles.botsGrid}>
                {bots.map(b => (
                  <div key={b.id} style={styles.botCard}>
                    <div style={styles.botCardTop}>
                      <div style={styles.botIcon}>🤖</div>
                      <span style={{ ...styles.statusBadge,
                        background: b.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                        color: b.status === 'active' ? '#22c55e' : 'rgba(255,255,255,0.3)',
                        border: `1px solid ${b.status === 'active' ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`
                      }}>
                        {b.status === 'active' ? '● Ativo' : '○ Inativo'}
                      </span>
                    </div>
                    <div style={styles.botName}>{b.name}</div>
                    <div style={styles.botPhone}>{b.phone_number_id ? `📱 ${b.phone_number_id}` : 'Sem número configurado'}</div>
                    <div style={styles.botStats}>
                      <div><div style={styles.botStatN}>{b.total_messages||0}</div><div style={styles.botStatL}>Mensagens</div></div>
                      <div><div style={styles.botStatN}>{b.active_sessions||0}</div><div style={styles.botStatL}>Sessões</div></div>
                    </div>
                    <div style={styles.botGreeting}>"{b.greeting}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Uso ── */}
          {tab === 'usage' && (
            <div style={styles.tabContent}>
              <h2 style={styles.sectionTitle}>Uso & Plano</h2>
              <p style={styles.sectionSub}>Acompanhe o consumo do seu plano {plan.label} este mês.</p>
              <div style={styles.usageGrid}>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Plano atual</div>
                  <div style={styles.usageValue}>{plan.label}</div>
                  <div style={styles.usageSub}>{tenant.billing_provider === 'google_play' ? '✓ Google Play' : 'Direto'}</div>
                </div>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Mensagens este mês</div>
                  <div style={styles.usageValue}>{usage?.messages || 0}</div>
                  <div style={styles.usageSub}>de {plan.max_messages_month.toLocaleString()} incluídas</div>
                  <div style={styles.usageBar}>
                    <div style={{ ...styles.usageBarFill, width: `${usagePct}%`, background: usagePct > 85 ? '#ef4444' : '#4f8ef7' }} />
                  </div>
                  <div style={styles.usagePct}>{usagePct}% utilizado</div>
                </div>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Bots ativos</div>
                  <div style={styles.usageValue}>{bots.filter(b => b.status === 'active').length}</div>
                  <div style={styles.usageSub}>de {plan.max_bots} permitidos</div>
                </div>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Status</div>
                  <div style={{ ...styles.usageValue, color: tenant.status === 'active' ? '#22c55e' : '#ef4444' }}>
                    {tenant.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </div>
                  {tenant.plan_expires_at && (
                    <div style={styles.usageSub}>Expira: {new Date(tenant.plan_expires_at).toLocaleDateString('pt-BR')}</div>
                  )}
                </div>
              </div>
              <div style={styles.featuresSection}>
                <h3 style={styles.featuresTitle}>Incluído no seu plano</h3>
                <div style={styles.featuresList}>
                  {plan.features.map(f => (
                    <div key={f} style={styles.featureItem}>
                      <span style={{ color: '#22c55e' }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <a href="https://play.google.com/store/apps/details?id=com.arkiel.assistenteark"
                   target="_blank" rel="noreferrer" style={styles.upgradeBtn}>
                  Fazer upgrade via Google Play →
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

// ── Estilos ──────────────────────────────────────────────────
const styles = {
  loadingScreen: { background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  // Paywall
  paywallRoot: { background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '72px 72px' },
  paywallCard: { maxWidth: 900, width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 24, padding: '52px 48px', textAlign: 'center' },
  paywallBadge: { display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 100, padding: '5px 14px', marginBottom: 20 },
  paywallTitle: { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: -1, marginBottom: 12 },
  paywallSub: { fontSize: 15, color: 'rgba(255,255,255,0.35)', marginBottom: 40, lineHeight: 1.7 },
  paywallPlans: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 36, textAlign: 'left' },
  paywallPlan: { border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 24px', position: 'relative' },
  paywallPlanFeatured: { border: '1px solid rgba(79,142,247,0.35)', background: 'rgba(79,142,247,0.04)' },
  paywallPlanBadge: { position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 12px', borderRadius: 100, whiteSpace: 'nowrap' },
  paywallPlanName: { fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 },
  paywallPlanPrice: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5, marginBottom: 16 },
  paywallFeatures: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  paywallFeat: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 },
  paywallBtn: { display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s' },
  paywallBtnPrimary: { background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff' },
  paywallBtnGhost: { border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', background: 'transparent' },
  paywallNote: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },
  paywallRefresh: { background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 12, fontWeight: 600, textDecoration: 'underline' },
  // Layout
  root: { display: 'flex', height: '100vh', overflow: 'hidden', background: '#000' },
  sidebar: { width: 220, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  sidebarTop: { padding: '0 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 16 },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 16 },
  logoText: { fontSize: 12, fontWeight: 800, letterSpacing: 3, color: '#fff', textTransform: 'uppercase' },
  planBadge: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 },
  planDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%' },
  navItemActive: { background: 'rgba(255,255,255,0.06)', color: '#fff' },
  navIcon: { fontSize: 15, flexShrink: 0 },
  navLabel: { flex: 1 },
  navCount: { fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 100, padding: '2px 7px', color: 'rgba(255,255,255,0.4)' },
  logoutBtn: { margin: '16px 8px 0', padding: '9px 12px', background: 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: 'rgba(255,255,255,0.25)', fontSize: 12, cursor: 'pointer', textAlign: 'left' },
  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  tabContent: { flex: 1, overflowY: 'auto', padding: 36 },
  sectionTitle: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
  sectionSub: { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 28, lineHeight: 1.6 },
  // Chat layout
  chatLayout: { display: 'flex', height: '100%', overflow: 'hidden' },
  convList: { width: 300, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  convListHeader: { padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  searchInput: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 12, outline: 'none', marginTop: 10, fontFamily: 'inherit' },
  convItems: { flex: 1, overflowY: 'auto' },
  convItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.1s' },
  convItemActive: { background: 'rgba(79,142,247,0.08)' },
  convAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'rgba(79,142,247,0.2)', color: '#4f8ef7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  convInfo: { flex: 1, minWidth: 0 },
  convName: { fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convLast: { fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  convTime: { fontSize: 10, color: 'rgba(255,255,255,0.2)' },
  statusDot: { width: 7, height: 7, borderRadius: '50%' },
  emptyState: { padding: 32, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.2)' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  chatPlaceholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 },
  chatHeaderName: { fontSize: 14, fontWeight: 700, color: '#fff' },
  chatHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  statusBadge: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100 },
  chatMessages: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 },
  msgWrapper: { display: 'flex' },
  msgBubble: { maxWidth: '70%', padding: '10px 14px', borderRadius: 14, fontSize: 13, color: '#fff', lineHeight: 1.5 },
  msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textAlign: 'right' },
  // Bots
  botsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 },
  botCard: { border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 24px', background: 'rgba(255,255,255,0.02)' },
  botCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  botIcon: { fontSize: 24 },
  botName: { fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: -0.3 },
  botPhone: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20 },
  botStats: { display: 'flex', gap: 24, marginBottom: 16 },
  botStatN: { fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 },
  botStatL: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  botGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 },
  // Usage
  usageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 20, marginBottom: 36 },
  usageCard: { border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '24px 20px', background: 'rgba(255,255,255,0.02)' },
  usageLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 },
  usageValue: { fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -1, marginBottom: 4 },
  usageSub: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  usageBar: { height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  usageBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s' },
  usagePct: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6 },
  featuresSection: { border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 24px', background: 'rgba(255,255,255,0.02)' },
  featuresTitle: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 },
  featuresList: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 },
  featureItem: { fontSize: 13, color: 'rgba(255,255,255,0.45)', display: 'flex', gap: 10 },
  upgradeBtn: { display: 'inline-block', background: '#fff', color: '#000', padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }
}
