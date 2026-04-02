import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'

export default function ClientPortal() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadClientData(session.user)
      else setLoading(false)
    })
  }, [])

  async function loadClientData(u) {
    setUser(u)
    const { data: memberData } = await supabase
      .from('tenant_members').select('role, tenants(*)').eq('user_id', u.id).single()
    if (memberData) {
      setTenant(memberData.tenants)
      loadConversations(memberData.tenants.id)
    }
    setLoading(false)
  }

  async function loadConversations(tenantId) {
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(name, phone)')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false })
      .limit(30)
    setConversations(data || [])
  }

  async function selectConv(conv) {
    setSelected(conv)
    const { data } = await supabase.from('messages')
      .select('*').eq('conversation_id', conv.id)
      .order('created_at', { ascending: true }).limit(100)
    setMessages(data || [])
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword(loginForm)
    if (error) { setLoginError(error.message); return }
    const { data: { user } } = await supabase.auth.getUser()
    loadClientData(user)
  }

  if (loading) return <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f8ef7' }}>Carregando…</div>

  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
        <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>Portal do Cliente</h2>
        <p style={{ color: '#475569', fontSize: 13, marginBottom: 28 }}>Acompanhe suas conversas e interações</p>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="E-mail" value={loginForm.email}
            onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
            className="ark-input" style={{ marginBottom: 12 }} required />
          <input type="password" placeholder="Senha" value={loginForm.password}
            onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
            className="ark-input" style={{ marginBottom: 18 }} required />
          {loginError && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{loginError}</div>}
          <button type="submit" className="ark-btn" style={{ width: '100%' }}>Entrar</button>
        </form>
        <p style={{ color: '#334155', fontSize: 12, marginTop: 16 }}>
          Admin? <a href="/admin" style={{ color: '#4f8ef7' }}>Painel Admin →</a>
        </p>
      </div>
    </div>
  )

  const STATUS_MAP = {
    open: { label: 'Aberta', color: '#4f8ef7' },
    bot: { label: 'Bot', color: '#8b5cf6' },
    human: { label: 'Humano', color: '#f59e0b' },
    closed: { label: 'Encerrada', color: '#475569' }
  }

  const filtered = conversations.filter(c =>
    (c.contacts?.name || c.contacts?.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080810', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: '#0a0a14', borderRight: '1px solid rgba(79,142,247,0.1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid rgba(79,142,247,0.08)' }}>
          <div style={{ fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>
            💬 Conversas
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 12 }}>{tenant?.name}</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="ark-input" style={{ fontSize: 12 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(conv => {
            const s = STATUS_MAP[conv.status] || STATUS_MAP.open
            return (
              <div key={conv.id} onClick={() => selectConv(conv)}
                style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)',
                  background: selected?.id === conv.id ? 'rgba(79,142,247,0.08)' : 'transparent',
                  borderLeft: selected?.id === conv.id ? '3px solid #4f8ef7' : '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                    {conv.contacts?.name || conv.contacts?.phone || '—'}
                  </span>
                  <span style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>● {s.label}</span>
                </div>
                <div style={{ color: '#475569', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message || '…'}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div style={{ padding: 24, color: '#334155', fontSize: 13, textAlign: 'center' }}>Nenhuma conversa</div>}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(79,142,247,0.08)' }}>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          <button onClick={async () => { await supabase.auth.signOut(); setUser(null) }}
            style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sair</button>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selected ? (
          <>
            <div style={{ padding: '14px 22px', background: '#0a0a14', borderBottom: '1px solid rgba(79,142,247,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700 }}>{selected.contacts?.name || selected.contacts?.phone}</div>
                <div style={{ color: '#475569', fontSize: 12 }}>{selected.contacts?.phone}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: `${(STATUS_MAP[selected.status]?.color || '#4f8ef7')}22`, color: STATUS_MAP[selected.status]?.color || '#4f8ef7' }}>
                ● {STATUS_MAP[selected.status]?.label}
              </span>
            </div>
            <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-start' : 'flex-end' }}>
                  <div style={{
                    maxWidth: '66%',
                    background: msg.direction === 'inbound' ? '#0d0d1e' : 'rgba(79,142,247,0.1)',
                    border: `1px solid ${msg.direction === 'inbound' ? 'rgba(255,255,255,0.04)' : 'rgba(79,142,247,0.2)'}`,
                    borderRadius: msg.direction === 'inbound' ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                    padding: '9px 13px'
                  }}>
                    {msg.direction === 'outbound' && <div style={{ fontSize: 9, color: '#4f8ef7', fontWeight: 700, marginBottom: 3 }}>🤖 BOT</div>}
                    <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{msg.content}</p>
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 4, textAlign: 'right' }}>
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 14 }}>
            ← Selecione uma conversa para ver o histórico
          </div>
        )}
      </div>
    </div>
  )
}
