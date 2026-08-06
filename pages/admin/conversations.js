/**
 * Conversas — tela principal estilo WhatsApp Web.
 * Lista de chats à esquerda + conversa à direita.
 * Mídia (imagens, vídeos, áudios, documentos) renderiza inline com cache global.
 */
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

// Cache global de blob URLs
const mediaCache = new Map()

function parseMediaContent(content) {
  if (!content) return null
  const m = content.match(/^__media__:(\w+):([\w-]+)__(?:\s(.*))?$/s)
  if (!m) return null
  return { type: m[1], mediaId: m[2], caption: m[3]?.trim() || '' }
}

function MediaBubble({ msg, getToken, botId }) {
  const parsed = parseMediaContent(msg.content)
  const [url, setUrl] = useState(parsed ? mediaCache.get(parsed.mediaId) : null)
  const [loading, setLoading] = useState(!url && !!parsed)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!parsed || url) return
    let cancelled = false
    async function fetchMedia() {
      const { mediaId } = parsed
      if (mediaCache.has(mediaId)) { setUrl(mediaCache.get(mediaId)); setLoading(false); return }
      try {
        const token = await getToken()
        const res = await fetch(`/api/media/${mediaId}?bot_id=${botId || ''}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        mediaCache.set(mediaId, blobUrl)
        if (!cancelled) { setUrl(blobUrl); setLoading(false) }
      } catch (e) { if (!cancelled) { setError(e.message); setLoading(false) } }
    }
    fetchMedia()
    return () => { cancelled = true }
  }, [parsed?.mediaId])

  if (!parsed) return null
  const { type, mediaId, caption } = parsed

  if (loading) return (
    <div style={{ width: 240, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(79,142,247,0.06)', borderRadius: 8 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>{type === 'image' ? '🖼️' : type === 'video' ? '🎬' : type === 'audio' ? '🎵' : '📎'}</div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Carregando…</span>
      </div>
    </div>
  )
  if (error) return <div style={{ padding: '10px 14px', fontSize: 12, color: '#ef4444' }}>❌ Não foi possível carregar a mídia</div>

  if (type === 'image' && url) return (
    <div>
      <img src={url} alt={caption || 'Imagem'} onClick={() => window.open(url, '_blank')}
        style={{ maxWidth: 280, maxHeight: 360, borderRadius: 8, display: 'block', cursor: 'pointer', objectFit: 'cover' }} />
      {caption && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4, margin: '6px 4px 0', whiteSpace: 'pre-line' }}>{caption}</p>}
    </div>
  )
  if (type === 'video' && url) return (
    <div>
      <video src={url} controls style={{ maxWidth: 280, maxHeight: 360, borderRadius: 8, display: 'block' }} />
      {caption && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.4, margin: '6px 4px 0', whiteSpace: 'pre-line' }}>{caption}</p>}
    </div>
  )
  if (type === 'audio' && url) return <div style={{ padding: '4px 0', minWidth: 220 }}><audio src={url} controls style={{ width: '100%' }} /></div>
  if (url) {
    const name = caption || 'documento'
    return (
      <a href={url} download={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textDecoration: 'none', background: 'var(--blue-tint)', borderRadius: 8, minWidth: 200, maxWidth: 260 }}>
        <span style={{ fontSize: 28 }}>📎</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#4f8ef7', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Clique para baixar</div>
        </div>
      </a>
    )
  }
  return null
}

export default function ConversationsPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState('')
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaPreview, setMediaPreview] = useState(null)
  const fileInputRef = useRef(null)
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const endRef = useRef(null)
  const listEndRef = useRef(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  // Carregar conversas
  async function loadConversations() {
    if (!tenant) return
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(name, phone), bots(name)')
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .limit(50)
    setConversations(data || [])
    setSelected(prev => prev ? { ...prev, ...(data || []).find(c => c.id === prev.id) } : prev)
  }

  useEffect(() => {
    if (!tenant) return
    loadConversations()
    const channel = supabase.channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tenant.id}` }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tenant.id}` }, (payload) => {
        setSelected(prev => {
          if (prev && payload.new.conversation_id === prev.id) setMessages(m => [...m, payload.new])
          return prev
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tenant])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function selectConversation(conv) {
    setSelected(conv)
    setDraft('')
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }
  }
  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const STATUS_MAP = {
    open: { label: 'Aberta', color: '#4f8ef7' },
    bot: { label: 'Bot', color: '#8b5cf6' },
    human: { label: 'Humano', color: '#f59e0b' },
    closed: { label: 'Encerrada', color: '#475569' }
  }

  const filtered = conversations.filter(c => {
    const name = c.contacts?.name || c.contacts?.phone || ''
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || c.contacts?.phone?.includes(search)
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  const isHuman = selected?.status === 'human'
  const isClosed = selected?.status === 'closed'
  const selectedBotId = selected?.bots?.id || selected?.bot_id

  async function handleToggleMode() {
    if (!selected || toggling) return
    const nextMode = selected.status === 'human' ? 'bot' : 'human'
    setToggling(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/toggle-mode', { method: 'POST', headers, body: JSON.stringify({ conversation_id: selected.id, mode: nextMode }) })
      if (!res.ok) throw new Error('Falha ao alternar')
      setSelected(p => ({ ...p, status: nextMode }))
      loadConversations()
    } catch (e) { alert(e.message) } finally { setToggling(false) }
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected || sending) return
    setSending(true)
    const optimistic = { id: `tmp-${Date.now()}`, conversation_id: selected.id, direction: 'outbound', type: 'text', content: text, sent_by: 'human', created_at: new Date().toISOString() }
    setMessages(m => [...m, optimistic])
    setDraft('')
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/send-message', { method: 'POST', headers, body: JSON.stringify({ conversation_id: selected.id, text }) })
      if (!res.ok) throw new Error('Falha ao enviar')
      if (selected.status !== 'human') { setSelected(p => ({ ...p, status: 'human' })); loadConversations() }
    } catch (e) {
      alert(e.message); setMessages(m => m.filter(msg => msg.id !== optimistic.id)); setDraft(text)
    } finally { setSending(false) }
  }

  async function handleSendMedia(e) {
    const file = e.target.files?.[0]
    if (!file || !selected || mediaUploading) return
    if (file.size > 50 * 1024 * 1024) { alert('Máximo 50MB.'); e.target.value = ''; return }
    setMediaUploading(true)
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setMediaPreview({ name: file.name, type: file.type, size: file.size, url: previewUrl })
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('conversation_id', selected.id)
      formData.append('file', file)
      if (draft.trim()) formData.append('caption', draft.trim())
      const res = await fetch('/api/send-media', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar')
      const mType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document'
      const icon = mType === 'image' ? '🖼️' : mType === 'video' ? '🎬' : mType === 'audio' ? '🎵' : '📎'
      const optimistic = { id: `tmp-${Date.now()}`, conversation_id: selected.id, direction: 'outbound', type: mType, content: `__media__:${mType}:${json.media_id}__ ${icon} ${draft.trim() || file.name}`, sent_by: 'human', created_at: new Date().toISOString() }
      setMessages(m => [...m, optimistic])
      setDraft('')
      if (selected.status !== 'human') { setSelected(p => ({ ...p, status: 'human' })); loadConversations() }
    } catch (e) { alert(e.message) } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setMediaUploading(false); setMediaPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: '#4f8ef7', gap: 10, fontSize: 14 }}>
        <div className="ark-spinner" /> Carregando…
      </div>
    )
  }

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile} hideTopBar>
      <div className="ark-wa-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {/* ─── PAINEL ESQUERDO: Header próprio + Lista de conversas ─── */}
        <div className={`ark-wa-list${selected ? ' ark-wa-hidden' : ''}`} style={{
          width: 380, minWidth: 320, maxWidth: 420,
          borderRight: '1px solid var(--border-soft)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-sidebar)',
        }}>
          {/* Header do painel esquerdo — estilo WhatsApp */}
          <div style={{
            height: 60, padding: '0 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-sidebar)',
            borderBottom: '1px solid var(--border-soft)',
          }}>
            {/* Avatar do bot + nome */}
            <Link href="/admin/conversations" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(6,182,212,0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--border-strong)',
              }}>
                <img src="/assistente-ark-icon.png" alt="Ark" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{
                  fontWeight: 800, fontSize: 14,
                  background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Assistente Ark</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Online · {tenant.name}
                </div>
              </div>
            </Link>

            {/* Botões à direita: catálogo + três pontinhos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link href="/admin/products" title="Catálogo"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)',
                  textDecoration: 'none', fontSize: 17,
                }}>📦</Link>
              <ThreeDotsMenu tenant={tenant} user={user} role={role} profile={profile} />
            </div>
          </div>

          {/* Barra de busca + filtros */}
          <div style={{ padding: 10, borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--bg-input)', borderRadius: 10, padding: '8px 12px',
              border: '1px solid var(--border-soft)',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}>
              {[{ k: 'all', l: 'Todas' }, { k: 'human', l: '👤 Humano' }, { k: 'bot', l: '🤖 Bot' }, { k: 'closed', l: '🔒 Fechadas' }].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  style={{
                    padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    background: filter === f.k ? '#4f8ef7' : 'var(--bg-secondary)',
                    color: filter === f.k ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>{f.l}</button>
              ))}
            </div>
          </div>

          {/* Lista de conversas */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                Nenhuma conversa ainda.<br />Quando alguém mandar mensagem no seu WhatsApp, aparece aqui.
              </div>
            )}
            {filtered.map(conv => {
              const s = STATUS_MAP[conv.status] || STATUS_MAP.open
              const active = selected?.id === conv.id
              return (
                <div key={conv.id} onClick={() => selectConversation(conv)}
                  className={conv.status === 'human' && !active ? 'ark-pulse-human' : ''}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border-white)',
                    background: active ? 'var(--blue-tint)' : 'transparent',
                    display: 'flex', gap: 12, alignItems: 'center',
                    transition: 'background 0.1s',
                  }}>
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: conv.status === 'human' && !active
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))'
                        : 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(139,92,246,0.1))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 700,
                      color: conv.status === 'human' && !active ? '#f59e0b' : '#4f8ef7',
                      border: conv.status === 'human' && !active ? '2px solid rgba(245,158,11,0.4)' : 'none',
                    }}>
                      {(conv.contacts?.name || conv.contacts?.phone || '?')[0].toUpperCase()}
                    </div>
                    {conv.status === 'human' && !active && (
                      <div style={{
                        position: 'absolute', top: -2, right: -2,
                        width: 12, height: 12, borderRadius: '50%',
                        background: '#f59e0b', border: '2px solid var(--bg-sidebar)',
                        animation: 'ark-pulse-human 1.5s ease-in-out infinite',
                      }} />
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.contacts?.name || conv.contacts?.phone || 'Desconhecido'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.last_message || '…'}
                      </span>
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                        background: s.color === '#f59e0b' ? 'rgba(245,158,11,0.15)' : s.color === '#8b5cf6' ? 'rgba(139,92,246,0.15)' : s.color === '#475569' ? 'rgba(71,85,105,0.15)' : 'rgba(79,142,247,0.15)',
                        color: s.color,
                      }}>{s.label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={listEndRef} />
          </div>
        </div>

        {/* ─── PAINEL DIREITO: Conversa ─── */}
        <div className={`ark-wa-chat${!selected ? ' ark-wa-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
          {selected ? (
            <>
              {/* Header da conversa */}
              <div style={{
                height: 60, padding: '0 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--bg-sidebar)',
                borderBottom: '1px solid var(--border-soft)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Botão voltar — só aparece no mobile */}
                  <button onClick={() => setSelected(null)}
                    className="ark-wa-back"
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      display: 'none', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 20, color: 'var(--text-secondary)',
                    }}>←</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(139,92,246,0.1))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#4f8ef7',
                  }}>
                    {(selected.contacts?.name || selected.contacts?.phone || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{selected.contacts?.name || selected.contacts?.phone}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>{selected.contacts?.phone}</div>
                  </div>
                </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {!isClosed && (
                    <button onClick={handleToggleMode} disabled={toggling}
                      title={isHuman ? 'Devolver para o bot' : 'Assumir atendimento'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 6px 5px 14px', borderRadius: 20,
                        border: `1px solid ${isHuman ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}`,
                        background: isHuman ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                        cursor: toggling ? 'wait' : 'pointer', opacity: toggling ? 0.6 : 1,
                      }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isHuman ? '#f59e0b' : '#8b5cf6' }}>{isHuman ? '👤 Humano' : '🤖 Bot'}</span>
                      <span style={{ width: 32, height: 18, borderRadius: 10, background: isHuman ? '#f59e0b' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background .15s' }}>
                        <span style={{ position: 'absolute', top: 2, left: isHuman ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                      </span>
                    </button>
                  )}
                  {selected.status !== 'closed' && (
                    <button onClick={async () => { await supabase.from('conversations').update({ status: 'closed' }).eq('id', selected.id); loadConversations(); setSelected(p => ({ ...p, status: 'closed' })) }}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                      Encerrar
                    </button>
                  )}
                </div>
              </div>

              {/* Mensagens */}
              <div style={{
                flex: 1, padding: '20px 28px', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 8,
                backgroundImage: 'var(--bg-main)',
              }}>
                {messages.map(msg => {
                  const parsed = parseMediaContent(msg.content)
                  const isMedia = !!parsed
                  const isInbound = msg.direction === 'inbound'
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isInbound ? 'flex-start' : 'flex-end' }}>
                      <div style={{
                        maxWidth: '75%',
                        background: isInbound ? 'var(--bg-secondary)' : (msg.sent_by === 'human' ? 'rgba(245,158,11,0.12)' : 'rgba(79,142,247,0.12)'),
                        border: `1px solid ${isInbound ? 'var(--border-soft)' : (msg.sent_by === 'human' ? 'rgba(245,158,11,0.25)' : 'var(--blue-border)')}`,
                        borderRadius: isInbound ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                        padding: isMedia ? '5px' : '9px 13px',
                        overflow: 'hidden',
                      }}>
                        {msg.direction === 'outbound' && (
                          <div style={{ fontSize: 9, color: msg.sent_by === 'human' ? '#f59e0b' : '#4f8ef7', fontWeight: 700, marginBottom: 3, padding: isMedia ? '3px 6px 0' : 0 }}>
                            {msg.sent_by === 'human' ? '👤 VOCÊ' : '🤖 BOT'}
                          </div>
                        )}
                        {isMedia && <MediaBubble msg={msg} getToken={getToken} botId={selectedBotId} />}
                        {!isMedia && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line', margin: 0 }}>{msg.content}</p>}
                        <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 4, textAlign: 'right', padding: isMedia ? '0 4px 2px' : 0 }}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div style={{ padding: '10px 20px', background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border-soft)' }}>
                {isClosed ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, padding: '8px 0' }}>
                    Conversa encerrada. Altere o status para reabrir.
                  </div>
                ) : (
                  <>
                    {!isHuman && <div style={{ color: '#8b5cf6', fontSize: 11, marginBottom: 8 }}>🤖 O bot está atendendo. Envie uma mensagem para assumir.</div>}
                    {mediaPreview && (
                      <div style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--blue-tint)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {mediaPreview.url ? <img src={mediaPreview.url} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ fontSize: 20 }}>{mediaPreview.type?.startsWith('video/') ? '🎬' : mediaPreview.type?.startsWith('audio/') ? '🎵' : '📎'}</span>}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mediaPreview.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{mediaUploading ? 'Enviando…' : `${(mediaPreview.size / 1024 / 1024).toFixed(1)}MB`}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#4f8ef7' }}>⏳</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={handleSendMedia} style={{ display: 'none' }} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={mediaUploading} title="Enviar arquivo"
                        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-dim)', cursor: mediaUploading ? 'wait' : 'pointer', fontSize: 18, minWidth: 42, minHeight: 42 }}>📎</button>
                      <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite uma mensagem..." rows={1}
                        style={{ flex: 1, resize: 'none', background: 'var(--bg-input)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', maxHeight: 120, outline: 'none' }} />
                      <button onClick={handleSend} disabled={sending || !draft.trim()}
                        style={{ padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, background: '#4f8ef7', color: '#fff', cursor: (sending || !draft.trim()) ? 'not-allowed' : 'pointer', opacity: (sending || !draft.trim()) ? 0.5 : 1 }}>
                        {sending ? '...' : 'Enviar'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            /* Estado vazio — igual WhatsApp Web quando não tem conversa selecionada */
            <div className="ark-wa-empty-mobile" style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-faint)', gap: 12, padding: 40,
            }}>
              <img src="/assistente-ark-icon.png" alt="Ark" style={{ width: 64, height: 64, opacity: 0.4 }} />
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-dim)' }}>Assistente Ark</div>
              <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
                Selecione uma conversa à esquerda para começar a atender,<br />ou aguarde — quando alguém mandar mensagem no seu WhatsApp, aparece aqui.
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

/* ─── Menu três pontinhos (componente separado) ─── */
import Link from 'next/link'

function ThreeDotsMenu({ tenant, user, role, profile }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef(null)
  const [_, setTheme] = useState('dark')

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('ark-theme') || 'dark' : 'dark'
    setTheme(saved)
  }, [])

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setOpen(false) }, [router.pathname])

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark'
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    if (typeof localStorage !== 'undefined') localStorage.setItem('ark-theme', next)
    setTheme(next)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const MENU_ITEMS = [
    { href: '/admin/whatsapp-setup', label: 'Conectar WhatsApp', icon: '📱' },
    { href: '/admin/bots', label: 'Configurar Bot', icon: '🤖' },
    { href: '/admin/flow', label: 'Editor de Fluxo', icon: '⚡' },
    { href: '/admin/contacts', label: 'Contatos', icon: '👥' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { href: '/admin/settings', label: 'Configurações', icon: '⚙️' },
    { href: '/admin/api', label: 'API', icon: '🔌' },
  ]
  if (profile?.is_platform_admin) MENU_ITEMS.push({ href: '/painel', label: 'Painel Arkiel', icon: '⚡' })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Menu"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? 'var(--blue-tint)' : 'var(--bg-secondary)',
          border: open ? '1px solid var(--border-strong)' : '1px solid var(--border-soft)',
          cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)',
        }}>⋮</button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
          borderRadius: 12, padding: 6, minWidth: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 200,
        }}>
          {/* Info do usuário */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{role}</div>
              </div>
            </div>
          </div>

          {/* Toggle tema */}
          <button onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', fontSize: 13,
              color: 'var(--text-secondary)',
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️'}</span>
              <span>Tema {document.documentElement.getAttribute('data-theme') === 'light' ? 'Claro' : 'Escuro'}</span>
            </span>
            <span style={{
              width: 36, height: 20, borderRadius: 10,
              background: document.documentElement.getAttribute('data-theme') === 'dark' ? '#4f8ef7' : 'rgba(0,0,0,0.15)',
              position: 'relative',
            }}>
              <span style={{ position: 'absolute', top: 2, left: document.documentElement.getAttribute('data-theme') === 'dark' ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </span>
          </button>

          {/* Items de navegação */}
          {MENU_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
                color: router.pathname === item.href ? '#4f8ef7' : 'var(--text-secondary)',
                background: router.pathname === item.href ? 'var(--blue-tint)' : 'transparent',
                fontSize: 13, fontWeight: router.pathname === item.href ? 600 : 400,
              }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Sair */}
          <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 4, paddingTop: 4 }}>
            <button onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 12px', borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer',
                color: '#ef4444', fontSize: 13, fontWeight: 500,
              }}>
              <span style={{ fontSize: 16 }}>🚪</span>
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
