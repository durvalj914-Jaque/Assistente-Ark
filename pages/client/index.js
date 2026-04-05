import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'

function LoginView({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) setError(error.message)
    else onLogin()
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(79,142,247,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 12px' }}>🤖</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0' }}>Portal do Cliente</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Acesse suas conversas</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>E-MAIL</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" className="ark-input" required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>SENHA</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="ark-input" required />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef4444', marginBottom: 14 }}>{error}</div>}
          <button type="submit" className="ark-btn" style={{ width: '100%', padding: 11 }} disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ClientPortal() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const endRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadClientData(session.user)
      else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadClientData(u) {
    setUser(u)
    const { data: memberData } = await supabase
      .from('tenant_members').select('role, tenants(*)').eq('user_id', u.id).single()
    if (memberData) {
      setTenant(memberData.tenants)
      const { data: convData } = await supabase
        .from('conversations')
        .select('*, contacts(*), bots(name)')
        .eq('tenant_id', memberData.tenants.id)
        .order('last_message_at', { ascending: false })
        .limit(50)
      setConversations(convData || [])
    }
    setLoading(false)
  }

  async function selectConversation(conv) {
    setSelected(conv)
    const { data } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setTenant(null); setConversations([]); setSelected(null); setMessages([])
  }

  if (loading) return <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f8ef7', fontFamily: 'Inter, sans-serif' }}>Carregando…</div>
  if (!user) return <LoginView onLogin={() => { supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user) { setLoading(true); loadClientData(session.user) } }) }} />
  if (!tenant) return <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, sans-serif', flexDirection: 'column', gap: 16 }}>
    <div style={{ fontSize: 32 }}>😕</div>
    <p>Nenhuma conta encontrada para este usuário.</p>
    <button onClick={handleLogout} className="ark-btn">Sair</button>
  </div>

  const filtered = conversations.filter(c =>
    (c.contacts?.name || c.contacts?.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  const statusColor = { open: '#4f8ef7', bot: '#8b5cf6', human: '#f59e0b', closed: '#475569' }
  const statusLabel = { open: 'Aberta', bot: 'Bot', human: 'Humano', closed: 'Fechada' }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#080810', fontFamily: 'Inter, sans-serif', color: '#fff', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{ width: 300, borderRight: '1px solid rgba(79,142,247,0.1)', display: 'flex', flexDirection: 'column', background: '#0a0a14', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(79,142,247,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{tenant.name}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Portal do Cliente</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {tenant && (
                <button onClick={() => router.push('/admin')} title="Painel Admin" style={{ background: 'rgba(79,142,247,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#4f8ef7', fontSize: 11, padding: '4px 8px' }}>Admin</button>
              )}
              <button onClick={handleLogout} title="Sair" style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#ef4444', fontSize: 11, padding: '4px 8px' }}>Sair</button>
            </div>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="ark-input"
            style={{ fontSize: 12 }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 13 }}>
              {search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}
            </div>
          )}
          {filtered.map(conv => (
            <div key={conv.id} onClick={() => selectConversation(conv)}
              style={{
                padding: '12px 16px', cursor: 'pointer',
                background: selected?.id === conv.id ? 'rgba(79,142,247,0.1)' : 'transparent',
                borderLeft: selected?.id === conv.id ? '3px solid #4f8ef7' : '3px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${statusColor[conv.status] || '#475569'},#0a0a14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(conv.contacts?.name || conv.contacts?.phone || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{conv.contacts?.name || conv.contacts?.phone || 'Desconhecido'}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>{conv.bots?.name}</div>
                  </div>
                </div>
                <div>
                  <span style={{ background: `${statusColor[conv.status]}20`, color: statusColor[conv.status], fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
                    {statusLabel[conv.status] || conv.status}
                  </span>
                </div>
              </div>
              {conv.last_message && (
                <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 40 }}>
                  {conv.last_message}
                </div>
              )}
              <div style={{ fontSize: 10, color: '#334155', marginTop: 4, paddingLeft: 40 }}>
                {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(79,142,247,0.08)', display: 'flex', gap: 16 }}>
          {[
            ['💬', conversations.length, 'total'],
            ['🟢', conversations.filter(c => c.status === 'open' || c.status === 'bot').length, 'ativas'],
          ].map(([icon, count, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
              <span>{icon}</span><span style={{ fontWeight: 700, color: '#94a3b8' }}>{count}</span><span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334155', gap: 12 }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Selecione uma conversa</div>
            <div style={{ fontSize: 13, color: '#334155' }}>Escolha uma conversa na lista ao lado</div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(79,142,247,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0a14', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg,${statusColor[selected.status] || '#475569'},#0a0a14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>
                  {(selected.contacts?.name || selected.contacts?.phone || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{selected.contacts?.name || selected.contacts?.phone || 'Desconhecido'}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    {selected.contacts?.phone} · {selected.bots?.name}
                  </div>
                </div>
              </div>
              <span style={{ background: `${statusColor[selected.status]}20`, color: statusColor[selected.status], fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 12 }}>
                {statusLabel[selected.status] || selected.status}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#334155', fontSize: 13, marginTop: 40 }}>Nenhuma mensagem ainda</div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%',
                    background: msg.direction === 'outbound' ? 'linear-gradient(135deg,#4f8ef7,#06b6d4)' : '#12121f',
                    border: msg.direction === 'inbound' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    borderRadius: msg.direction === 'outbound' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    padding: '10px 14px',
                  }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: '#e2e8f0' }}>{msg.content}</div>
                    <div style={{ fontSize: 10, color: msg.direction === 'outbound' ? 'rgba(255,255,255,0.5)' : '#334155', marginTop: 4, textAlign: 'right' }}>
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {msg.direction === 'outbound' && <span style={{ marginLeft: 4 }}>{ msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓' }</span>}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Info bar */}
            <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(79,142,247,0.08)', background: '#0a0a14', display: 'flex', gap: 20, flexShrink: 0 }}>
              {[
                ['📱', 'Telefone', selected.contacts?.phone || '—'],
                ['📧', 'Email', selected.contacts?.email || '—'],
                ['🏷️', 'Tags', (selected.contacts?.tags || []).join(', ') || '—'],
              ].map(([icon, label, val]) => (
                <div key={label} style={{ fontSize: 11 }}>
                  <span style={{ color: '#334155' }}>{icon} {label}: </span>
                  <span style={{ color: '#64748b' }}>{val}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
