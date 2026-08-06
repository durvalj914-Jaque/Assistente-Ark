/**
 * Conversas — chat com mídia igual WhatsApp Web.
 * Imagens, vídeos, áudios e documentos são exibidos inline e persistem.
 * media_id é extraído do campo content no formato: __media__:{type}:{id}__ {caption}
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'

// Cache global de blob URLs — sobrevive a re-renders
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
      // Já está em cache?
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
        if (!cancelled) {
          setUrl(blobUrl)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      }
    }
    fetchMedia()
    return () => { cancelled = true }
  }, [parsed?.mediaId])

  if (!parsed) return null

  const { type, mediaId, caption } = parsed

  if (loading) {
    return (
      <div style={{ width: 240, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(79,142,247,0.06)', borderRadius: 8 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>
            {type === 'image' ? '🖼️' : type === 'video' ? '🎬' : type === 'audio' ? '🎵' : '📎'}
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>Carregando…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '10px 14px', fontSize: 12, color: '#ef4444' }}>
        ❌ Não foi possível carregar a mídia
      </div>
    )
  }

  // IMAGEM — igual WhatsApp: preenche o balão, clica pra abrir
  if (type === 'image' && url) {
    return (
      <div style={{ position: 'relative' }}>
        <img
          src={url}
          alt={caption || 'Imagem'}
          onClick={() => window.open(url, '_blank')}
          style={{
            maxWidth: 280, maxHeight: 360, borderRadius: 8, display: 'block',
            cursor: 'pointer', objectFit: 'cover',
          }}
        />
        {caption && (
          <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.4, margin: '6px 4px 0', whiteSpace: 'pre-line' }}>
            {caption}
          </p>
        )}
      </div>
    )
  }

  // VÍDEO — player inline
  if (type === 'video' && url) {
    return (
      <div>
        <video
          src={url}
          controls
          style={{ maxWidth: 280, maxHeight: 360, borderRadius: 8, display: 'block' }}
        />
        {caption && (
          <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.4, margin: '6px 4px 0', whiteSpace: 'pre-line' }}>
            {caption}
          </p>
        )}
      </div>
    )
  }

  // ÁUDIO — player compacto
  if (type === 'audio' && url) {
    return (
      <div style={{ padding: '4px 0', minWidth: 220 }}>
        <audio src={url} controls style={{ width: '100%' }} />
      </div>
    )
  }

  // DOCUMENTO — card com nome e download
  if (url) {
    const name = caption || 'documento'
    return (
      <a
        href={url}
        download={name}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', textDecoration: 'none',
          background: 'rgba(79,142,247,0.08)', borderRadius: 8,
          minWidth: 200, maxWidth: 260,
        }}
      >
        <span style={{ fontSize: 28 }}>📎</span>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#4f8ef7', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Clique para baixar</div>
        </div>
      </a>
    )
  }

  return null
}

export default function ConversationsPage() {
  const { user, tenant, role, profile, loading } = useTenant()
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [search, setSearch] = useState('')
  const fileInputRef = useRef(null)
  const endRef = useRef(null)
  const tokenRef = useRef(null)

  // Cache do token para não buscar toda hora
  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('sb-access-token') || localStorage.getItem('access_token') : null
    if (raw) {
      tokenRef.current = raw
      return raw
    }
    return ''
  }, [])

  async function authHeaders() {
    const token = await getToken()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }

  async function loadConversations() {
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/admin/conversations', { headers })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setConversations(data)
    } catch {}
  }

  async function loadMessages(convId) {
    try {
      const headers = await authHeaders()
      const res = await fetch(`/api/admin/conversations?conversation_id=${convId}&include=messages`, { headers })
      const data = await res.json()
      if (res.ok && data.messages) {
        setMessages(data.messages)
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {}
  }

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selected) loadMessages(selected.id)
    else setMessages([])
  }, [selected?.id])

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected || sending) return
    setSending(true)
    const optimistic = {
      id: `tmp-${Date.now()}`, conversation_id: selected.id, direction: 'outbound',
      type: 'text', content: text, sent_by: 'human', created_at: new Date().toISOString()
    }
    setMessages(m => [...m, optimistic])
    setDraft('')
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/send-message', {
        method: 'POST', headers, body: JSON.stringify({ conversation_id: selected.id, text })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar mensagem')
      if (selected.status !== 'human') {
        setSelected(p => ({ ...p, status: 'human' }))
        loadConversations()
      }
    } catch (e) {
      alert(e.message)
      setMessages(m => m.filter(msg => msg.id !== optimistic.id))
      setDraft(text)
    } finally {
      setSending(false)
    }
  }

  async function handleSendMedia(e) {
    const file = e.target.files?.[0]
    if (!file || !selected || mediaUploading) return

    if (file.size > 50 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 50MB.')
      e.target.value = ''
      return
    }

    setMediaUploading(true)
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setMediaPreview({ name: file.name, type: file.type, size: file.size, url: previewUrl })

    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('conversation_id', selected.id)
      formData.append('file', file)
      if (draft.trim()) formData.append('caption', draft.trim())

      const res = await fetch('/api/send-media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao enviar mídia')

      const icon = file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : file.type.startsWith('audio/') ? '🎵' : '📎'
      const mType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document'
      const optimistic = {
        id: `tmp-${Date.now()}`, conversation_id: selected.id, direction: 'outbound',
        type: mType, content: `__media__:${mType}:${json.media_id}__ ${icon} ${draft.trim() || file.name}`,
        sent_by: 'human', created_at: new Date().toISOString(),
      }
      setMessages(m => [...m, optimistic])
      setDraft('')

      if (selected.status !== 'human') {
        setSelected(p => ({ ...p, status: 'human' }))
        loadConversations()
      }
    } catch (e) {
      alert(e.message)
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setMediaUploading(false)
      setMediaPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function toggleMode() {
    if (!selected || toggling) return
    setToggling(true)
    const nextMode = selected.status === 'human' ? 'bot' : 'human'
    try {
      const headers = await authHeaders()
      await fetch('/api/toggle-mode', {
        method: 'POST', headers, body: JSON.stringify({ conversation_id: selected.id, mode: nextMode })
      })
      setSelected(p => ({ ...p, status: nextMode }))
      loadConversations()
    } catch (e) {
      alert(e.message)
    } finally {
      setToggling(false)
    }
  }

  if (loading || !user || !tenant) return null

  const isHuman = selected?.status === 'human'
  const isClosed = selected?.status === 'closed'

  const filtered = conversations.filter(c =>
    !search || c.contact_name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  const selectedBotId = selected?.bots?.id || selected?.bot_id

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>💬 Conversas</h1>
      <div style={{ display: 'flex', height: 'calc(100vh - 160px)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(79,142,247,0.12)' }}>
        {/* Lista */}
        <div style={{ width: 280, borderRight: '1px solid rgba(79,142,247,0.08)', display: 'flex', flexDirection: 'column', background: '#0a0a14' }}>
          <div style={{ padding: 12, borderBottom: '1px solid rgba(79,142,247,0.06)' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa…"
              style={{
                width: '100%', background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.15)',
                borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#334155', fontSize: 12 }}>
                Nenhuma conversa.
              </div>
            )}
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: selected?.id === c.id ? 'rgba(79,142,247,0.08)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                    {c.contact_name || c.phone}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                    background: c.status === 'human' ? 'rgba(245,158,11,0.15)' : c.status === 'bot' ? 'rgba(139,92,246,0.15)' : 'rgba(100,116,139,0.1)',
                    color: c.status === 'human' ? '#f59e0b' : c.status === 'bot' ? '#8b5cf6' : '#64748b',
                  }}>
                    {c.status === 'human' ? '👤 HUMANO' : c.status === 'bot' ? '🤖 BOT' : '🔒 FECHADA'}
                  </span>
                </div>
                {c.last_message && (
                  <p style={{ fontSize: 11, color: '#475569', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.last_message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#08080f' }}>
          {selected ? (
            <>
              {/* Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(79,142,247,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                    {selected.contact_name || selected.phone}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{selected.phone}</div>
                </div>
                <button
                  onClick={toggleMode}
                  disabled={toggling}
                  style={{
                    fontSize: 11, padding: '6px 14px', borderRadius: 8, fontWeight: 700,
                    border: `1px solid ${isHuman ? 'rgba(139,92,246,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    background: isHuman ? 'rgba(139,92,246,0.1)' : 'rgba(245,158,11,0.08)',
                    color: isHuman ? '#8b5cf6' : '#f59e0b', cursor: 'pointer',
                  }}
                >
                  {toggling ? '...' : isHuman ? '🤖 Passar pro bot' : '👤 Assumir atendimento'}
                </button>
              </div>

              {/* Mensagens */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                        {isMedia && (
                          <MediaBubble msg={msg} getToken={getToken} botId={selectedBotId} />
                        )}
                        {!isMedia && (
                          <p style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line', margin: 0 }}>
                            {msg.content}
                          </p>
                        )}
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
                  <div style={{ textAlign: 'center', color: '#334155', fontSize: 12, padding: '8px 0' }}>
                    Conversa encerrada — reabra alterando o status para enviar mensagens.
                  </div>
                ) : (
                  <>
                    {!isHuman && (
                      <div style={{ color: '#8b5cf6', fontSize: 11, marginBottom: 8 }}>
                        🤖 O bot está atendendo automaticamente. Envie uma mensagem ou use o switch acima para assumir o atendimento.
                      </div>
                    )}
                    {mediaPreview && (
                      <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(79,142,247,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {mediaPreview.url ? (
                          <img src={mediaPreview.url} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <span style={{ fontSize: 20 }}>{mediaPreview.type?.startsWith('video/') ? '🎬' : mediaPreview.type?.startsWith('audio/') ? '🎵' : '📎'}</span>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mediaPreview.name}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{mediaUploading ? 'Enviando…' : `${(mediaPreview.size / 1024 / 1024).toFixed(1)}MB`}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#4f8ef7' }}>⏳</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                        onChange={handleSendMedia}
                        style={{ display: 'none' }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={mediaUploading || isClosed}
                        title="Enviar imagem, vídeo ou arquivo"
                        style={{
                          padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(79,142,247,0.2)',
                          background: '#0d0d1e', color: '#94a3b8', cursor: mediaUploading ? 'wait' : 'pointer',
                          fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 42, minHeight: 42, opacity: mediaUploading ? 0.5 : 1,
                        }}
                      >
                        📎
                      </button>
                      <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite uma mensagem…"
                        rows={1}
                        style={{
                          flex: 1, resize: 'none', background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.15)',
                          borderRadius: 10, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
                          maxHeight: 120, outline: 'none',
                        }}
                      />
                      <button onClick={handleSend} disabled={sending || !draft.trim()}
                        style={{
                          padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
                          background: '#4f8ef7', color: '#fff', cursor: (sending || !draft.trim()) ? 'not-allowed' : 'pointer',
                          opacity: (sending || !draft.trim()) ? 0.5 : 1,
                        }}>
                        {sending ? '...' : 'Enviar'}
                      </button>
                    </div>
                  </>
                )}
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
