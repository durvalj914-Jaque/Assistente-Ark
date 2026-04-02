import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function ConversationsPage() {
  const router = useRouter()
  const { user, tenant, role, loading } = useTenant()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const endRef = useRef(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadConversations()
    // Realtime
    const channel = supabase.channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tenant.id}` }, loadConversations)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tenant])

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(name, phone)')
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .limit(50)
    setConversations(data || [])
  }

  async function selectConversation(conv) {
    setSelected(conv)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const STATUS_MAP = {
    open: { label: 'Aberta', color: '#4f8ef7' },
    bot: { label: 'Bot', color: '#8b5cf6' },
    human: { label: 'Humano', color: '#f59e0b' },
    closed: { label: 'Encerrada', color: '#475569' }
  }

  const filtered = conversations.filter(c => {
    const name = c.contacts?.name || c.contacts?.phone || ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  if (loading || !user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>💬 Conversas</h1>
      <div style={{ display: 'flex', height: 'calc(100vh - 160px)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(79,142,247,0.12)' }}>
        {/* Lista */}
        <div style={{ width: 300, background: '#0a0a14', borderRight: '1px solid rgba(79,142,247,0.1)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(79,142,247,0.08)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="ark-input" style={{ fontSize: 12, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['all','open','bot','human','closed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    background: filter === f ? '#4f8ef7' : 'rgba(255,255,255,0.04)',
                    color: filter === f ? '#fff' : '#475569' }}>
                  {f === 'all' ? 'Todas' : STATUS_MAP[f]?.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map(conv => {
              const s = STATUS_MAP[conv.status] || STATUS_MAP.open
              return (
                <div key={conv.id} onClick={() => selectConversation(conv)}
                  style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: selected?.id === conv.id ? 'rgba(79,142,247,0.08)' : 'transparent',
                    borderLeft: selected?.id === conv.id ? '3px solid #4f8ef7' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{conv.contacts?.name || conv.contacts?.phone || 'Desconhecido'}</span>
                    <span style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>● {s.label}</span>
                  </div>
                  <div style={{ color: '#475569', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.last_message || '…'}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 13 }}>Nenhuma conversa</div>}
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#080810' }}>
          {selected ? (
            <>
              <div style={{ padding: '14px 20px', background: '#0a0a14', borderBottom: '1px solid rgba(79,142,247,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{selected.contacts?.name || selected.contacts?.phone}</div>
                  <div style={{ color: '#475569', fontSize: 11 }}>{selected.contacts?.phone}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.status !== 'closed' && (
                    <button onClick={async () => {
                      await supabase.from('conversations').update({ status: 'closed' }).eq('id', selected.id)
                      loadConversations()
                      setSelected(p => ({ ...p, status: 'closed' }))
                    }} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                      Encerrar
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '65%',
                      background: msg.direction === 'inbound' ? '#0d0d1e' : 'rgba(79,142,247,0.12)',
                      border: `1px solid ${msg.direction === 'inbound' ? 'rgba(255,255,255,0.04)' : 'rgba(79,142,247,0.2)'}`,
                      borderRadius: msg.direction === 'inbound' ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                      padding: '9px 13px'
                    }}>
                      {msg.direction === 'outbound' && <div style={{ fontSize: 9, color: '#4f8ef7', fontWeight: 700, marginBottom: 3 }}>🤖 BOT</div>}
                      <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{msg.content}</p>
                      <div style={{ fontSize: 9, color: '#334155', marginTop: 5, textAlign: 'right' }}>
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
              ← Selecione uma conversa
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
