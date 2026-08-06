/**
 * Conversas — chat com mídia igual WhatsApp Web.
 * Usa Supabase client direto + realtime para atualizações instantâneas.
 * Mídia: media_id é extraído do content no formato __media__:{type}:{id}__ {caption}
 */
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

// Cache global de blob URLs — sobrevive a re-renders e troca de conversa
const mediaCache = new Map() // mediaId -> blobUrl

/** Extrai media_id e type do campo content. */
function parseMediaContent(content) {
  if (!content) return null
  const m = content.match(/^__media__:(\w+):([\w-]+)__(?:\s(.*))?$/s)
  if (!m) return null
  return { type: m[1], mediaId: m[2], caption: m[3]?.trim() || '' }
}

/** Componente que renderiza mídia igual WhatsApp Web. */
function MediaBubble({ msg, getToken, botId }) {
  const parsed = parseMediaContent(msg.content)
  const [url, setUrl] = useState(parsed ? mediaCache.get(parsed.mediaId) : null)
  const [loading, setLoading] = useState(!url && !!parsed)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!parsed || url) return
    let cancelled = false

    async function fetchMedia() {
      const { mediaId, type } = parsed
      if (mediaCache.has(mediaId)) {
        setUrl(mediaCache.get(mediaId))
        setLoading(false)
        return
      }
      try {
        const token = await getToken()
        const res = await fetch(`/api/media/${mediaId}?bot_id=${botId || ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        mediaCache.set(mediaId, blobUrl)
        if (!cancelled) { setUrl(blobUrl); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
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
        <span style={{ fontSize: 11, color: '#64748b' }}>Carregando…</span>
      </div>
    </div>
  )
  if (error) return <div style={{ padding: '10px 14px', fontSize: 12, color: '#ef4444' }}>❌ Não foi possível carregar a mídia</div>

  if (type === 'image' && url) return (
    <div style={{ position: 'relative' }}>
      <img src={url} alt={caption || 'Imagem'} onClick={() => window.open(url, '_blank')}
        style={{ maxWidth: 280, maxHeight: 360, borderRadius: 8, display: 'block', cursor: 'pointer', objectFit: 'cover' }} />
      {caption && <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.4, margin: '6px 4px 0', whiteSpace: 'pre-line' }}>{caption}</p>}
    </div>
  )
  if (type === 'video' && url) return (
    <div>
      <video src={url} controls style={{ maxWidth: 280, maxHeight: 360, borderRadius: 8, display: 'block' }} />
      {caption && <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.4, margin: '6px 4px 0', whiteSpace: 'pre-line' }}>{caption}</p>}
    </div>
  )
  if (type === 'audio' && url) return (
    <div style={{ padding: '4px 0', minWidth: 220 }}><audio src={url} controls style={{ width: '100%' }} /></div>
  )
  if (url) {
    const name = caption || 'documento'
    return (
      <a href={url} download={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', textDecoration: 'none', background: 'rgba(79,142,247,0.08)', borderRadius: 8, minWidth: 200, maxWidth: 260 }}>
        <span style={{ fontSize: 28 }}>📎</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#4f8ef7', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Clique para baixar</div>
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

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadConversations()
    const channel = supabase.channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tenant.id}` }, () => {
        loadConversations()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tenant.id}` }, (payload) => {
        setSelected(prev => {
          if (prev && payload.new.conversation_id === prev.id) {
            setMessages(m => [...m, payload.new])
          }
          return prev
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tenant])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(name, phone), bots(name)')
      .eq('tenant_id', tenant.id)
      .order('last_message_at', { ascending: false })
      .limit(50)
    setConversations(data || [])
    setSelected(prev => {
      if (!prev) return prev
      const fresh = (data || []).find(c => c.id === prev.id)
      return fresh ? { ...prev, status: fresh.status } : prev
    })
  }

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
    const matchSearch = name.toLowerCase().includes(search.toLowerCase())
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
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao alternar modo')
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
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar mensagem')
      if (selected.status !== 'human') { setSelected(p => ({ ...p, status: 'human' })); loadConversations() }
    } catch (e) {
      alert(e.message)
      setMessages(m => m.filter(msg => msg.id !== optimistic.id))
      setDraft(text)
    } finally { setSending(false) }
  }

  async function handleSendMedia(e) {
    const file = e.target.files?.[0]
    if (!file || !selected || mediaUploading) return
    if (file.size > 50 * 1024 * 1024) { alert('Arquivo muito grande. Máximo 50MB.'); e.target.value = ''; return }
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
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar mídia')
      const icon = file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : file.type.startsWith('audio/') ? '🎵' : '📎'
      const mType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document'
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

  if (loading || !user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>💬 Conversas</h1>
      <div style={{ display: 'flex', height: 'calc(100vh - 160px)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(79,142,247,0.12)' }}>
        {/* Lista */}
        <div style={{ width: 300, borderRight: '1px solid rgba(79,142,247,0.08)', display: 'flex', flexDirection: 'column', background: '#0a0a14' }}>
          <div style={{ padding: 12, borderBottom: '1px solid rgba(79,142,247,0.06)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa…"
              style={{ width: '100%', background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              {['all', 'human', 'bot', 'closed'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    background: filter === f ? '#4f8ef7' : 'rgba(255,255,255,0.04)', color: filter === f ? '#fff' : '#475569' }}>
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {!isClosed && (
                    <button onClick={handleToggleMode} disabled={toggling}
                      title={isHuman ? 'Devolver o atendimento para o bot' : 'Assumir o atendimento manualmente'}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px 5px 12px', borderRadius: 20, border: `1px solid ${isHuman ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}`, background: isHuman ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)', cursor: toggling ? 'wait' : 'pointer', opacity: toggling ? 0.6 : 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isHuman ? '#f59e0b' : '#8b5cf6' }}>{isHuman ? '👤 Humano' : '🤖 Bot'}</span>
                      <span style={{ width: 32, height: 18, borderRadius: 10, background: isHuman ? '#f59e0b' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background .15s' }}>
                        <span style={{ position: 'absolute', top: 2, left: isHuman ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                      </span>
                    </button>
                  )}
                  {selected.status !== 'closed' && (
                    <button onClick={async () => { await supabase.from('conversations').update({ status: 'closed' }).eq('id', selected.id); loadConversations(); setSelected(p => ({ ...p, status: 'closed' })) }}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>
                      Encerrar
                    </button>
                  )}
                </div>
              </div>

              {/* Mensagens */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(msg => {
                  const parsed = parseMediaContent(msg.content)
                  const isMedia = !!parsed
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-start' : 'flex-end' }}>
                      <div style={{
                        maxWidth: '75%',
                        background: msg.direction === 'inbound' ? '#0d0d1e' : (msg.sent_by === 'human' ? 'rgba(245,158,11,0.12)' : 'rgba(79,142,247,0.12)'),
                        border: `1px solid ${msg.direction === 'inbound' ? 'rgba(255,255,255,0.04)' : (msg.sent_by === 'human' ? 'rgba(245,158,11,0.25)' : 'rgba(79,142,247,0.2)')}`,
                        borderRadius: msg.direction === 'inbound' ? '12px 12px 12px 2px' : '12px 12px 2px 12px',
                        padding: isMedia ? '5px' : '9px 13px',
                        overflow: 'hidden',
                      }}>
                        {msg.direction === 'outbound' && (
                          <div style={{ fontSize: 9, color: msg.sent_by === 'human' ? '#f59e0b' : '#4f8ef7', fontWeight: 700, marginBottom: 3, padding: isMedia ? '3px 6px 0' : 0 }}>
                            {msg.sent_by === 'human' ? '👤 VOCÊ' : '🤖 BOT'}
                          </div>
                        )}
                        {isMedia && <MediaBubble msg={msg} getToken={getToken} botId={selectedBotId} />}
                        {!isMedia && <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line', margin: 0 }}>{msg.content}</p>}
                        <div style={{ fontSize: 9, color: '#334155', marginTop: 4, textAlign: 'right', padding: isMedia ? '0 4px 2px' : 0 }}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div style={{ padding: '12px 16px', background: '#0a0a14', borderTop: '1px solid rgba(79,142,247,0.08)' }}>
                {isClosed ? (
                  <div style={{ textAlign: 'center', color: '#334155', fontSize: 12, padding: '8px 0' }}>Conversa encerrada — reabra alterando o status para enviar mensagens.</div>
                ) : (
                  <>
                    {!isHuman && <div style={{ color: '#8b5cf6', fontSize: 11, marginBottom: 8 }}>🤖 O bot está atendendo automaticamente. Envie uma mensagem ou use o switch acima para assumir o atendimento.</div>}
                    {mediaPreview && (
                      <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(79,142,247,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {mediaPreview.url ? <img src={mediaPreview.url} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ fontSize: 20 }}>{mediaPreview.type?.startsWith('video/') ? '🎬' : mediaPreview.type?.startsWith('audio/') ? '🎵' : '📎'}</span>}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mediaPreview.name}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{mediaUploading ? 'Enviando…' : `${(mediaPreview.size / 1024 / 1024).toFixed(1)}MB`}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#4f8ef7' }}>⏳</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" onChange={handleSendMedia} style={{ display: 'none' }} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={mediaUploading || isClosed} title="Enviar imagem, vídeo ou arquivo"
                        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(79,142,247,0.2)', background: '#0d0d1e', color: '#94a3b8', cursor: mediaUploading ? 'wait' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 42, minHeight: 42, opacity: mediaUploading ? 0.5 : 1 }}>📎</button>
                      <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite uma mensagem…" rows={1}
                        style={{ flex: 1, resize: 'none', background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 10, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', maxHeight: 120, outline: 'none' }} />
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 14 }}>← Selecione uma conversa</div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
