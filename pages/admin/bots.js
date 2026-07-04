import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, checkLimit } from '../../lib/plans'

const STATUS_COLOR = { active: '#10b981', inactive: '#475569', paused: '#f59e0b' }
const STATUS_LABEL = { active: 'Ativo', inactive: 'Inativo', paused: 'Pausado' }

const labelStyle = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

// Definido FORA do BotModal: se ficasse dentro, o React recriava esse componente
// a cada render (cada tecla digitada) e o input perdia o foco a cada caractere.
function Field({ label, name, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder} className="ark-input" />
      {hint && <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

// Seção de foto de perfil do WhatsApp — só aparece quando o bot já tem
// phone_number_id + access_token configurados (número já conectado na Meta).
function ProfilePhotoSection({ botId }) {
  const [currentUrl, setCurrentUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(true)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)

  const loadCurrent = useCallback(async () => {
    setLoadingUrl(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/whatsapp/profile-photo?bot_id=${botId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })
      const json = await res.json()
      setCurrentUrl(res.ok ? json.profile_picture_url : null)
    } catch (e) {
      setCurrentUrl(null)
    }
    setLoadingUrl(false)
  }, [botId])

  useEffect(() => { loadCurrent() }, [loadCurrent])

  function handlePick(e) {
    const f = e.target.files?.[0]
    setMessage(null)
    if (!f) return
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      setMessage({ type: 'error', text: 'Use uma imagem JPEG ou PNG.' })
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Imagem muito grande (máximo 5MB).' })
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function fileToBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const file_base64 = await fileToBase64(file)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/profile-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ bot_id: botId, file_base64, mime_type: file.type })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao atualizar a foto')
      setMessage({ type: 'success', text: 'Foto de perfil atualizada! Pode levar alguns minutos pra aparecer no WhatsApp.' })
      setFile(null)
      setPreview(null)
      setTimeout(loadCurrent, 3000)
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setUploading(false)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>FOTO DE PERFIL DO WHATSAPP</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: '#12121f', border: '1px solid rgba(79,142,247,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {preview ? (
            <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : loadingUrl ? (
            <span style={{ fontSize: 10, color: '#475569' }}>…</span>
          ) : currentUrl ? (
            <img src={currentUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 22 }}>📷</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label className="ark-btn-ghost" style={{ display: 'inline-block', padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
            Escolher imagem
            <input type="file" accept="image/jpeg,image/png" onChange={handlePick} style={{ display: 'none' }} />
          </label>
          {file && (
            <button onClick={handleUpload} disabled={uploading} className="ark-btn" style={{ marginLeft: 8, padding: '7px 12px', fontSize: 12 }}>
              {uploading ? 'Enviando…' : 'Salvar foto'}
            </button>
          )}
          {message && (
            <p style={{ color: message.type === 'error' ? '#ef4444' : '#10b981', fontSize: 11, marginTop: 6 }}>{message.text}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function BotModal({ bot, onClose, onSave }) {
  const [form, setForm] = useState({
    name:                   bot?.name || '',
    greeting:               bot?.greeting || 'Olá! Como posso ajudar? 🤖',
    fallback_message:       bot?.fallback_message || 'Não entendi. Pode repetir?',
    human_takeover_keyword: bot?.human_takeover_keyword || 'humano',
  })
  const [saving, setSaving] = useState(false)

  const setField = useCallback((name, value) => {
    setForm(f => ({ ...f, [name]: value }))
  }, [])

  async function handleSave() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  // Conexão com o WhatsApp é feita só pela equipe Arkiel (Painel Arkiel → Clientes),
  // nunca aqui — por isso não expomos nem deixamos editar o token/IDs da Meta
  // nesta tela. O token é um segredo de longa duração; melhor prática é ele
  // nunca trafegar pro navegador do cliente, nem mascarado.
  const hasWhatsappConnected = Boolean(bot?.id && bot?.phone_number_id)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{bot ? 'Editar Bot' : 'Novo Bot'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {hasWhatsappConnected && (
          <>
            <ProfilePhotoSection botId={bot.id} />
            <hr className="ark-divider" />
          </>
        )}

        <Field label="NOME DO BOT" name="name" value={form.name} onChange={setField} placeholder="Ex: Atendimento Principal" />
        <Field label="MENSAGEM DE BOAS-VINDAS" name="greeting" value={form.greeting} onChange={setField} placeholder="Olá! Como posso ajudar?" />
        <Field label="MENSAGEM FALLBACK" name="fallback_message" value={form.fallback_message} onChange={setField} placeholder="Não entendi. Pode repetir?" />
        <Field label="KEYWORD → HUMANO" name="human_takeover_keyword" value={form.human_takeover_keyword} onChange={setField} placeholder="humano" hint="Quando o usuário digitar isso, a conversa vai para atendimento humano" />

        <hr className="ark-divider" />
        <p style={{ color: '#475569', fontSize: 12, marginBottom: 10 }}>📱 Conexão com o WhatsApp</p>
        <div style={{
          background: hasWhatsappConnected ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${hasWhatsappConnected ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
          borderRadius: 8, padding: '12px 14px', marginBottom: 4,
        }}>
          <div style={{ color: hasWhatsappConnected ? '#10b981' : '#f59e0b', fontSize: 13, fontWeight: 600 }}>
            {hasWhatsappConnected ? '🟢 WhatsApp conectado' : '🟡 WhatsApp ainda não conectado'}
          </div>
          <p style={{ color: '#64748b', fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>
            {hasWhatsappConnected
              ? 'Por segurança, as credenciais da Meta não ficam visíveis aqui. Se precisar trocar o número ou o token, fale com a equipe Arkiel.'
              : 'Vá em "Conectar WhatsApp" no menu pra pedir a conexão do seu número — nossa equipe cuida da parte técnica com a Meta pra você.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className="ark-btn-ghost">Cancelar</button>
          <button onClick={handleSave} className="ark-btn" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar Bot'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BotsPage() {
  const router = useRouter()
  const { user, tenant, role, bots: initialBots, usage, profile, loading, refreshBots } = useTenant()
  const [bots, setBots] = useState([])
  const [editingBot, setEditingBot] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => { setBots(initialBots) }, [initialBots])

  const plan = PLANS[tenant?.plan] || PLANS.free
  const canCreateBot = bots.length < plan.max_bots

  async function handleCreate() {
    if (!canCreateBot) return
    setCreating(true)
    const { data } = await supabase.from('bots')
      .insert({ tenant_id: tenant.id, name: 'Novo Bot' })
      .select('id, tenant_id, name, status, phone_number_id, waba_id, greeting, fallback_message, human_takeover_keyword, flow, total_messages, active_sessions, created_at, updated_at, human_takeover_timeout').single()
    if (data) {
      setBots(prev => [...prev, data])
      setEditingBot(data)
      setShowModal(true)
    }
    setCreating(false)
  }

  async function handleSave(form) {
    const { data, error } = await supabase.from('bots')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', editingBot.id)
      .select('id, tenant_id, name, status, phone_number_id, waba_id, greeting, fallback_message, human_takeover_keyword, flow, total_messages, active_sessions, created_at, updated_at, human_takeover_timeout').single()
    if (!error) {
      setBots(prev => prev.map(b => b.id === editingBot.id ? data : b))
      setShowModal(false)
      setEditingBot(null)
    }
  }

  async function toggleStatus(bot) {
    const newStatus = bot.status === 'active' ? 'inactive' : 'active'
    await supabase.from('bots').update({ status: newStatus }).eq('id', bot.id)
    setBots(prev => prev.map(b => b.id === bot.id ? { ...b, status: newStatus } : b))
  }

  async function handleDelete(botId) {
    if (!confirm('Tem certeza? Isso apagará o bot e todas as conversas associadas.')) return
    setDeleting(botId)
    await supabase.from('bots').delete().eq('id', botId)
    setBots(prev => prev.filter(b => b.id !== botId))
    setDeleting(null)
  }

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  return (
    <>
      {showModal && (
        <BotModal
          bot={editingBot}
          onClose={() => { setShowModal(false); setEditingBot(null) }}
          onSave={handleSave}
        />
      )}

      <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>🤖 Bots</h1>
            <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
              {bots.length} / {plan.max_bots === 999 ? '∞' : plan.max_bots} bots no plano {plan.label}
            </p>
          </div>
          <button onClick={handleCreate} className="ark-btn" disabled={creating || !canCreateBot}
            title={!canCreateBot ? `Limite do plano ${plan.label} atingido` : ''}>
            {creating ? 'Criando…' : '+ Novo Bot'}
          </button>
        </div>

        {!canCreateBot && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ Você atingiu o limite de {plan.max_bots} bot{plan.max_bots !== 1 ? 's' : ''} do plano {plan.label}.</span>
            <button onClick={() => router.push('/admin/upgrade')} className="ark-btn" style={{ padding: '6px 14px', fontSize: 12 }}>Fazer upgrade</button>
          </div>
        )}

        {bots.length === 0 ? (
          <div className="ark-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h3 style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 8 }}>Nenhum bot ainda</h3>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>Crie seu primeiro bot e comece a automatizar o WhatsApp</p>
            <button onClick={handleCreate} className="ark-btn" disabled={creating}>+ Criar primeiro bot</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {bots.map(bot => (
              <div key={bot.id} className="ark-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🤖</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{bot.name}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {bot.phone_number_id ? `ID: ${bot.phone_number_id.slice(0, 8)}…` : 'Meta API não configurada'}
                      </div>
                    </div>
                  </div>
                  <span className={`ark-badge ${bot.status === 'active' ? 'ark-badge-green' : bot.status === 'paused' ? 'ark-badge-yellow' : 'ark-badge-gray'}`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {STATUS_LABEL[bot.status] || bot.status}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['💬', bot.total_messages || 0, 'Mensagens'],
                    ['🔄', bot.active_sessions || 0, 'Sessões ativas'],
                  ].map(([icon, val, label]) => (
                    <div key={label} style={{ background: '#12121f', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: '#475569', marginBottom: 2 }}>{icon} {label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Greeting preview */}
                <div style={{ background: '#12121f', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#64748b', borderLeft: '2px solid rgba(79,142,247,0.3)', fontStyle: 'italic' }}>
                  "{bot.greeting?.substring(0, 60)}{bot.greeting?.length > 60 ? '…' : ''}"
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => { setEditingBot(bot); setShowModal(true) }}
                    className="ark-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12, justifyContent: 'center' }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => router.push(`/admin/flow?bot=${bot.id}`)}
                    className="ark-btn-ghost" style={{ flex: 1, padding: '7px 10px', fontSize: 12, justifyContent: 'center' }}>
                    ⚡ Fluxo
                  </button>
                  <button onClick={() => toggleStatus(bot)}
                    style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      background: bot.status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      color: bot.status === 'active' ? '#ef4444' : '#10b981' }}>
                    {bot.status === 'active' ? '⏸ Pausar' : '▶ Ativar'}
                  </button>
                  <button onClick={() => handleDelete(bot.id)}
                    disabled={deleting === bot.id}
                    style={{ padding: '7px 12px', fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    {deleting === bot.id ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
