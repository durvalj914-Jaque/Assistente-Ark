import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, checkLimit } from '../../lib/plans'

const STATUS_COLOR = { active: '#10b981', inactive: '#475569', paused: '#f59e0b' }
const STATUS_LABEL = { active: 'Ativo', inactive: 'Inativo', paused: 'Pausado' }

function BotModal({ bot, onClose, onSave }) {
  const [form, setForm] = useState({
    name:                   bot?.name || '',
    greeting:               bot?.greeting || 'Olá! Como posso ajudar? 🤖',
    fallback_message:       bot?.fallback_message || 'Não entendi. Pode repetir?',
    human_takeover_keyword: bot?.human_takeover_keyword || 'humano',
    phone_number_id:        bot?.phone_number_id || '',
    access_token:           bot?.access_token || '',
    waba_id:                bot?.waba_id || '',
    webhook_verify_token:   bot?.webhook_verify_token || 'ark_secret',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const Field = ({ label, name, placeholder, type = 'text', hint }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder} className="ark-input" />
      {hint && <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>{hint}</p>}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{bot ? 'Editar Bot' : 'Novo Bot'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <Field label="NOME DO BOT" name="name" placeholder="Ex: Atendimento Principal" />
        <Field label="MENSAGEM DE BOAS-VINDAS" name="greeting" placeholder="Olá! Como posso ajudar?" />
        <Field label="MENSAGEM FALLBACK" name="fallback_message" placeholder="Não entendi. Pode repetir?" />
        <Field label="KEYWORD → HUMANO" name="human_takeover_keyword" placeholder="humano" hint="Quando o usuário digitar isso, a conversa vai para atendimento humano" />

        <hr className="ark-divider" />
        <p style={{ color: '#475569', fontSize: 12, marginBottom: 14 }}>⚙️ Configurações da Meta API (opcional — preencher ao conectar WhatsApp)</p>

        <Field label="PHONE NUMBER ID" name="phone_number_id" placeholder="123456789" />
        <Field label="ACCESS TOKEN" name="access_token" type="password" placeholder="EAAxxxxxx" hint="Token permanente da Meta API" />
        <Field label="WABA ID" name="waba_id" placeholder="ID da conta WhatsApp Business" />
        <Field label="WEBHOOK VERIFY TOKEN" name="webhook_verify_token" placeholder="ark_secret" hint="Usado na verificação do webhook da Meta" />

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
  const { user, tenant, role, bots: initialBots, usage, loading, refreshBots } = useTenant()
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
      .select().single()
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
      .select().single()
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

      <AdminLayout tenant={tenant} user={user} role={role}>
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
