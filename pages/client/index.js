/**
 * /client — Portal do Cliente
 * Acesso liberado apenas após pagamento de plano ativo
 * Mostra: conversas, mensagens em tempo real, status do bot
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'
import { PLANS, isPlanActive } from '../../lib/plans'
import WhatsAppSmsConnect from '../../components/WhatsAppSmsConnect'
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
        <img src="/assistente-ark-icon.png" alt="Assistente Ark" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 20 }} />
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
  const [availablePlans, setAvailablePlans] = useState([])
  const [currentSub, setCurrentSub] = useState(null)
  const [subscribing, setSubscribing] = useState(null) // plan_id being subscribed
  const [paymentModal, setPaymentModal] = useState(null) // { plan_name, amount, pix_code, qr_url, checkout_url }
  const [tab, setTab]         = useState('conversations') // conversations | bots | usage
  const [usage, setUsage]     = useState(null)
  const [catalogProducts, setCatalogProducts] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const endRef = useRef(null)
  const [payConfig, setPayConfig] = useState({ pix_key: '', merchant_name: '', merchant_city: '', mp_access_token: '' })
  const [mpConnected, setMpConnected] = useState(false)
  const [mpConnecting, setMpConnecting] = useState(false)
  const [mpUser, setMpUser] = useState('')
  const [savingPay, setSavingPay] = useState(false)
  const [payHistory, setPayHistory] = useState([])
  const [payLoading, setPayLoading] = useState(false)

  async function loadPlans() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/plans/list', { headers: { Authorization: 'Bearer ' + session.access_token } })
      const json = await res.json()
      if (json.plans) setAvailablePlans(json.plans)
      if (json.current_subscription) setCurrentSub(json.current_subscription)
    } catch (e) { console.error('loadPlans', e) }
  }

  useEffect(() => {
    if (tab === 'catalog') loadCatalog()
    if (tab === 'finance') loadPayConfig()
    if (tab === 'planos') loadPlans()
  }, [tab, tenant])

  async function loadPayConfig() {
    if (!tenant) return
    setPayLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/payments/config', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      if (d.config) {
        setPayConfig({
          pix_key: d.config.pix_key || '',
          merchant_name: d.config.merchant_name || '',
          merchant_city: d.config.merchant_city || '',
          mp_access_token: d.config.mp_access_token || ''
        })
        setMpConnected(!!d.config.mp_access_token)
      }
      // Check URL for MP OAuth callback
      if (router.query.mp_success) {
        setMpConnected(true)
        setMpUser(router.query.mp_user || '')
        alert('✅ Mercado Pago conectado com sucesso!')
        router.replace('/client', undefined, { shallow: true })
      }
      if (router.query.mp_error) {
        alert('❌ Erro ao conectar Mercado Pago: ' + router.query.mp_error)
        router.replace('/client', undefined, { shallow: true })
      }
      // Load payment history
      const r2 = await fetch('/api/payments/history', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d2 = await r2.json()
      if (d2.payments) setPayHistory(d2.payments)
    } catch (e) { console.error('pay config load:', e) }
    setPayLoading(false)
  }

  async function connectMP() {
    setMpConnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/mercadopago/oauth/init?return_to=client', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await r.json()
      if (d.authUrl) {
        window.location.href = d.authUrl
      } else {
        alert('Erro ao iniciar conexão')
      }
    } catch (e) { alert('Erro: ' + e.message) }
    setMpConnecting(false)
  }

  async function savePayConfig() {
    setSavingPay(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/payments/config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payConfig)
      })
      alert('Configuração salva!')
    } catch (e) { alert('Erro ao salvar') }
    setSavingPay(false)
  }

  async function loadPlans() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/plans/list', { headers: { Authorization: 'Bearer ' + session.access_token } })
      const json = await res.json()
      if (json.plans) setAvailablePlans(json.plans)
      if (json.current_subscription) setCurrentSub(json.current_subscription)
    } catch (e) { console.error('loadPlans', e) }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) load(session.user)
      else router.replace('/assistente-ark/entrar')
    })
  }, [])

  async function loadPlans() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/plans/list', { headers: { Authorization: 'Bearer ' + session.access_token } })
      const json = await res.json()
      if (json.plans) setAvailablePlans(json.plans)
      if (json.current_subscription) setCurrentSub(json.current_subscription)
    } catch (e) { console.error('loadPlans', e) }
  }

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
      supabase.from('bots').select('id, tenant_id, name, status, phone_number_id, waba_id, greeting, fallback_message, human_takeover_keyword, flow, total_messages, active_sessions, created_at, updated_at, human_takeover_timeout').eq('tenant_id', t.id).order('created_at'),
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

  async function loadCatalog() {
    if (!tenant) return
    setCatalogLoading(true)
    try {
      const r = await fetch(`/api/catalog/products?tenant=${tenant.id}`)
      const d = await r.json()
      if (d.products) setCatalogProducts(d.products)
    } catch (_) {}
    setCatalogLoading(false)
  }

  if (loading) return (
    <div style={styles.loadingScreen}>
      <img src="/assistente-ark-icon.png" style={{ width: 44, opacity: 0.7 }} alt="" />
      <p style={{ color: 'rgba(255,255,255,0.3)', marginTop: 16, fontSize: 13 }}>Carregando portal…</p>
    </div>
  )

  async function subscribePlan(planId, method) {
    setSubscribing(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/plans/subscribe', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, method })
      })
      const json = await res.json()
      if (json.ok) {
        setPaymentModal(json)
      } else {
        alert('Erro: ' + (json.error || 'Desconhecido'))
      }
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setSubscribing(null) }
  }

  // Paywall: plano free ou sem plano
  if (!isPlanActive(tenant) || tenant?.plan === 'free') {
    return <Paywall tenant={tenant} onRefresh={() => { setLoading(true); load(user) }} />
  }

  const plan     = PLANS[tenant?.plan] || PLANS.free
  // Tentar ler subscription dinâmica
  let dynSub = null
  try { dynSub = JSON.parse(tenant?.subscription || '{}') } catch {}
  const hasDynSub = dynSub && dynSub.status === 'active' && (!dynSub.expires_at || new Date(dynSub.expires_at) >= new Date())
  const effectiveLabel = hasDynSub ? (dynSub.plan_name || 'Personalizado') : plan.label
  const effectiveMaxMsg = hasDynSub ? (dynSub.limits?.max_messages_month || 500) : plan.max_messages_month
  const effectiveMaxBots = hasDynSub ? (dynSub.limits?.max_bots || 1) : plan.max_bots
  const effectiveFeatures = hasDynSub ? (dynSub.limits?.features || []) : plan.features
  const effectiveExpires = hasDynSub ? dynSub.expires_at : tenant?.plan_expires_at
  const usagePct = effectiveMaxMsg >= 999999 ? 0 : Math.min(Math.round(((usage?.messages||0) / effectiveMaxMsg) * 100), 100)
  const filteredConvs = convs.filter(c =>
    !search || (c.contacts?.name || c.contacts?.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Head><title>Portal do Cliente — Assistente Ark</title></Head>
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
              <img src="/assistente-ark-icon.png" alt="Assistente Ark" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span style={styles.logoText}>Assistente Ark</span>
            </Link>
            <div style={styles.planBadge}>
              <span style={{ ...styles.planDot, background: tenant.status === 'active' ? '#22c55e' : '#ef4444' }} />
              {effectiveLabel}
            </div>
          </div>

          <nav style={styles.nav}>
            {[
              { key: 'conversations', icon: '💬', label: 'Conversas', count: convs.length },
              { key: 'bots',          icon: '🤖', label: 'Meus Bots', count: bots.length },
              { key: 'catalog',       icon: '🛍️', label: 'Catálogo' },
            { key: 'whatsapp',       icon: '📶', label: 'WhatsApp' },
            { key: 'planos',        icon: '📋', label: 'Planos' },
            { key: 'finance',       icon: '💰', label: 'Financeiro' },
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

          <button onClick={() => supabase.auth.signOut().then(() => router.replace('/assistente-ark/entrar'))}
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
          {tab === 'catalog' && (
            <div style={styles.tabContent}>
              <h2 style={styles.sectionTitle}>🛍️ Catálogo</h2>
              <p style={styles.sectionSub}>
                Seus produtos visíveis para clientes finais. Compartilhe o link da sua vitrine:
              </p>

              {/* Link da vitrine */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  readOnly
                  value={`https://arkiel.com.br/catalog/${tenant?.id || ''}`}
                  style={{ ...styles.searchInput, flex: 1, maxWidth: 400, cursor: 'pointer' }}
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={() => {
                    const link = `https://arkiel.com.br/catalog/${tenant?.id || ''}`
                    navigator.clipboard?.writeText(link)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  style={{ ...styles.logoutBtn, color: '#4f8ef7', borderColor: 'rgba(79,142,247,0.25)', padding: '9px 16px', whiteSpace: 'nowrap' }}
                >
                  {copied ? '✓ Copiado!' : '📋 Copiar link'}
                </button>
                <a
                  href={`https://arkiel.com.br/catalog/${tenant?.id || ''}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...styles.logoutBtn, color: '#10b981', borderColor: 'rgba(16,185,129,0.25)', padding: '9px 16px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  👁️ Ver vitrine
                </a>
              </div>

              {/* Produtos */}
              {catalogLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                  <div className="ark-spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : catalogProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 8 }}>Nenhum produto no catálogo ainda</p>
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                    Acesse <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Admin → Catálogo</strong> para adicionar produtos.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {catalogProducts.map(p => (
                    <div key={p.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: 140, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { e.target.style.display = 'none' }} />
                        ) : (
                          <span style={{ fontSize: 36 }}>📦</span>
                        )}
                      </div>
                      <div style={{ padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>{p.name}</div>
                        {p.category && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#4f8ef7', background: 'rgba(79,142,247,0.1)', padding: '2px 6px', borderRadius: 100 }}>{p.category}</span>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                          <span style={{ color: '#10b981', fontWeight: 800, fontSize: 18 }}>
                            {Number(p.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            {p.stock !== null && p.stock !== undefined ? `${p.stock} un.` : '∞'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'finance' && (
            <div style={styles.tabContent}>
              <h2 style={styles.sectionTitle}>💰 Financeiro</h2>
              <p style={styles.sectionSub}>Configure como você recebe dos seus clientes via PIX e cartão.</p>

              {/* Mercado Pago Connection */}
              <div style={{ ...styles.usageCard, marginBottom: 20, padding: 24 }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🏦 Mercado Pago</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                  Conecte sua conta do Mercado Pago para receber pagamentos automaticamente no WhatsApp.
                  Os PIX e pagamentos no cartão caem direto na sua conta — a Arkiel cobra apenas uma pequena taxa por transação.
                </p>
                
                {mpConnected ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24 }}>✅</span>
                      <div>
                        <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>Mercado Pago conectado{mpUser ? ` (${mpUser})` : ''}</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>Pagamentos automáticos ativos</div>
                      </div>
                    </div>
                    <button onClick={() => { setMpConnected(false); setPayConfig(c => ({ ...c, mp_access_token: '' })); savePayConfig(); }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <button onClick={connectMP} disabled={mpConnecting}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #009ee3, #00b1c0)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: mpConnecting ? 0.6 : 1, transition: 'all 0.2s' }}>
                    <span style={{ fontSize: 22 }}>🔗</span>
                    {mpConnecting ? 'Conectando...' : 'Conectar Mercado Pago'}
                  </button>
                )}
                
                <div style={{ marginTop: 16, padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Como funciona:</strong><br />
                  • Clique no botão e autorize na página do Mercado Pago<br />
                  • Seus clientes pagam via PIX ou cartão no WhatsApp<br />
                  • O dinheiro cai direto na sua conta MP<br />
                  • A Arkiel cobra apenas uma taxa de 2% por transação<br />
                  • Você acompanha tudo na aba de histórico abaixo
                </div>
              </div>

              {/* PIX Manual Fallback */}
              <div style={{ ...styles.usageCard, marginBottom: 20, padding: 24 }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🟢 PIX Manual (Backup)</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
                  Usado como reserva caso o Mercado Pago falhe. O cliente recebe a chave e paga manualmente.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>Chave PIX</label>
                    <input value={payConfig.pix_key} onChange={e => setPayConfig(c => ({ ...c, pix_key: e.target.value }))}
                      placeholder="email, CPF, telefone..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, marginTop: 6 }} />
                  </div>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>Nome do Recebedor</label>
                    <input value={payConfig.merchant_name} onChange={e => setPayConfig(c => ({ ...c, merchant_name: e.target.value }))}
                      placeholder="Ex: João Silva"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, marginTop: 6 }} />
                  </div>
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>Cidade</label>
                    <input value={payConfig.merchant_city} onChange={e => setPayConfig(c => ({ ...c, merchant_city: e.target.value }))}
                      placeholder="Ex: SAO PAULO"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13, marginTop: 6 }} />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button onClick={savePayConfig} disabled={savingPay}
                style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: savingPay ? 0.5 : 1, marginBottom: 32 }}>
                {savingPay ? 'Salvando...' : '💾 Salvar Configuração'}
              </button>

              {/* Payment History */}
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📋 Histórico de Pagamentos</h3>
              {payLoading ? (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Carregando...</p>
              ) : payHistory.length === 0 ? (
                <div style={{ ...styles.usageCard, padding: 32, textAlign: 'center' }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhum pagamento recebido ainda</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {payHistory.map(p => (
                    <div key={p.id} style={{ ...styles.usageCard, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{p.description || 'Pagamento'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{new Date(p.created_at).toLocaleString('pt-BR')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>R$ {Number(p.amount).toFixed(2)}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: p.status === 'paid' ? '#22c55e' : p.status === 'pending' ? '#f59e0b' : '#ef4444' }}>
                          {p.status === 'paid' ? '✓ Confirmado' : p.status === 'pending' ? '⏳ Pendente' : '✕ Falhou'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'planos' && (
            <div style={styles.tabContent}>
              <h2 style={styles.sectionTitle}>Planos Disponíveis</h2>
              <p style={styles.sectionSub}>Escolha um plano e pague via PIX ou Mercado Pago. A ativação é automática.</p>

              {/* Assinatura atual */}
              {currentSub && currentSub.status === 'active' && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                      <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 15 }}>Plano Ativo: {currentSub.plan_name || currentSub.plan}</div>
                      {currentSub.expires_at && (
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                          {currentSub.expires_at === null || currentSub.billing_cycle === 'lifetime' ? 'Vitalício' : 'Expira em: ' + new Date(currentSub.expires_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                  {currentSub.limits?.features && currentSub.limits.features.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {currentSub.limits.features.map((f, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de planos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {availablePlans.length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, padding: 40, textAlign: 'center' }}>
                    Nenhum plano disponível no momento.
                  </div>
                )}
                {availablePlans.map((p, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    padding: 20,
                    position: 'relative',
                  }}>
                    {p.billing_cycle === 'monthly' && (
                      <div style={{ position: 'absolute', top: -8, right: 16, background: '#4f8ef7', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>POPULAR</div>
                    )}
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#4f8ef7', marginBottom: 12 }}>
                      R$ {typeof p.price === 'number' ? p.price.toFixed(2).replace('.', ',') : p.price}
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                        {p.billing_cycle === 'monthly' ? '/mês' : p.billing_cycle === 'yearly' ? '/ano' : p.billing_cycle === 'lifetime' ? ' vitalício' : ''}
                      </span>
                    </div>

                    {p.description && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>{p.description}</p>}

                    {p.resources && p.resources.length > 0 && (
                      <ul style={{ margin: '0 0 16px 0', paddingLeft: 18, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.8 }}>
                        {p.resources.map((r, j) => <li key={j}>{r.name} — <span style={{ color: 'rgba(255,255,255,0.4)' }}>R$ {r.price.toFixed(2).replace('.', ',')}</span></li>)}
                      </ul>
                    )}
                    {p.features && p.features.length > 0 && (
                      <ul style={{ margin: '0 0 16px 0', paddingLeft: 18, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.8 }}>
                        {p.features.map((f, j) => <li key={j}>{f}</li>)}
                      </ul>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => subscribePlan(p.id, 'pix')} disabled={subscribing === p.id}
                        style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: subscribing === p.id ? 0.5 : 1 }}>
                        {subscribing === p.id ? 'Gerando...' : 'PIX'}
                      </button>
                      <button onClick={() => subscribePlan(p.id, 'mercadopago')} disabled={subscribing === p.id}
                        style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: subscribing === p.id ? 0.5 : 1 }}>
                        Cartão
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal de pagamento */}
              {paymentModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setPaymentModal(null)}>
                  <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }}>
                    <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
                      💰 {paymentModal.plan_name} — R$ {paymentModal.amount.toFixed(2).replace('.', ',')}
                    </h3>

                    {paymentModal.qr_url && (
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <img src={paymentModal.qr_url} alt="QR Code PIX" style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
                      </div>
                    )}

                    {paymentModal.pix_code && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 }}>Código PIX (Copia e Cola):</div>
                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10, fontSize: 11, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all', fontFamily: 'monospace', cursor: 'pointer' }}
                          onClick={() => { navigator.clipboard.writeText(paymentModal.pix_code); alert('Código copiado!') }}>
                          {paymentModal.pix_code}
                        </div>
                      </div>
                    )}

                    {paymentModal.checkout_url && (
                      <a href={paymentModal.checkout_url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 8, background: '#4f8ef7', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 12 }}>
                        Pagar no Mercado Pago →
                      </a>
                    )}

                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
                      ✅ Após o pagamento, seu plano será ativado automaticamente.
                    </div>

                    <button onClick={() => setPaymentModal(null)}
                      style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'usage' && (
            <div style={styles.tabContent}>
              <h2 style={styles.sectionTitle}>Uso & Plano</h2>
              <p style={styles.sectionSub}>Acompanhe o consumo do seu plano {effectiveLabel} este mês.</p>
              <div style={styles.usageGrid}>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Plano atual</div>
                  <div style={styles.usageValue}>{effectiveLabel}</div>
                  <div style={styles.usageSub}>{hasDynSub ? '✓ Ativado via pagamento' : (tenant.billing_provider === 'google_play' ? '✓ Google Play' : 'Direto')}</div>
                </div>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Mensagens este mês</div>
                  <div style={styles.usageValue}>{usage?.messages || 0}</div>
                  <div style={styles.usageSub}>de {effectiveMaxMsg >= 999999 ? '∞' : effectiveMaxMsg.toLocaleString()} incluídas</div>
                  <div style={styles.usageBar}>
                    <div style={{ ...styles.usageBarFill, width: `${usagePct}%`, background: usagePct > 85 ? '#ef4444' : '#4f8ef7' }} />
                  </div>
                  <div style={styles.usagePct}>{usagePct === 0 && effectiveMaxMsg >= 999999 ? 'Ilimitado' : usagePct + '% utilizado'}</div>
                </div>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Bots ativos</div>
                  <div style={styles.usageValue}>{bots.filter(b => b.status === 'active').length}</div>
                  <div style={styles.usageSub}>de {effectiveMaxBots >= 999 ? '∞' : effectiveMaxBots} permitidos</div>
                </div>
                <div style={styles.usageCard}>
                  <div style={styles.usageLabel}>Status</div>
                  <div style={{ ...styles.usageValue, color: tenant.status === 'active' ? '#22c55e' : '#ef4444' }}>
                    {tenant.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </div>
                  {effectiveExpires && (
                    <div style={styles.usageSub}>Expira: {new Date(effectiveExpires).toLocaleDateString('pt-BR')}</div>
                  )}
                  {hasDynSub && !effectiveExpires && (
                    <div style={styles.usageSub}>Vitalício ♾️</div>
                  )}
                </div>
              </div>
              <div style={styles.featuresSection}>
                <h3 style={styles.featuresTitle}>Incluído no seu plano</h3>
                <div style={styles.featuresList}>
                  {effectiveFeatures.map(f => (
                    <div key={f} style={styles.featureItem}>
                      <span style={{ color: '#22c55e' }}>✓</span> {f}
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab('planos')} style={styles.upgradeBtn}>
                  Ver planos disponíveis →
                </button>
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
