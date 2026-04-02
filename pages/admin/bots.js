import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function BotsPage() {
  const router = useRouter()
  const { user, tenant, role, bots: initialBots, loading } = useTenant()
  const [bots, setBots] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => { setBots(initialBots) }, [initialBots])

  async function saveBot() {
    setSaving(true)
    const { data, error } = await supabase.from('bots')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
      .select().single()
    if (!error) {
      setBots(prev => prev.map(b => b.id === editing.id ? data : b))
      setEditing(null)
    }
    setSaving(false)
  }

  async function toggleStatus(bot) {
    const newStatus = bot.status === 'active' ? 'inactive' : 'active'
    await supabase.from('bots').update({ status: newStatus }).eq('id', bot.id)
    setBots(prev => prev.map(b => b.id === bot.id ? { ...b, status: newStatus } : b))
  }

  async function createBot() {
    setCreating(true)
    const { data } = await supabase.from('bots').insert({ tenant_id: tenant.id, name: 'Novo Bot' }).select().single()
    if (data) setBots(prev => [...prev, data])
    setCreating(false)
  }

  if (loading || !user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>🤖 Meus Bots</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{bots.length} bot(s) configurado(s)</p>
        </div>
        <button onClick={createBot} className="ark-btn" disabled={creating}>
          {creating ? 'Criando…' : '+ Novo Bot'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {bots.map(bot => (
          <div key={bot.id} className="ark-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{bot.name}</div>
                <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                  {bot.phone_number_id ? `📱 ${bot.phone_number_id.substring(0,10)}…` : '📱 Sem número configurado'}
                </div>
              </div>
              <button onClick={() => toggleStatus(bot)} style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: bot.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                color: bot.status === 'active' ? '#10b981' : '#ef4444'
              }}>
                {bot.status === 'active' ? '● Ativo' : '○ Inativo'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, background: '#12121f', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ color: '#4f8ef7', fontWeight: 700, fontSize: 16 }}>{bot.total_messages || 0}</div>
                <div style={{ color: '#475569', fontSize: 10 }}>mensagens</div>
              </div>
              <div style={{ flex: 1, background: '#12121f', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>{bot.active_sessions || 0}</div>
                <div style={{ color: '#475569', fontSize: 10 }}>sessões ativas</div>
              </div>
              <div style={{ flex: 1, background: '#12121f', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ color: '#8b5cf6', fontWeight: 700, fontSize: 16 }}>{bot.flow?.nodes?.length || 0}</div>
                <div style={{ color: '#475569', fontSize: 10 }}>nós no fluxo</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditing(bot); setForm({ name: bot.name, greeting: bot.greeting, fallback_message: bot.fallback_message, human_takeover_keyword: bot.human_takeover_keyword, phone_number_id: bot.phone_number_id || '', access_token: bot.access_token || '', waba_id: bot.waba_id || '', webhook_verify_token: bot.webhook_verify_token || 'ark_secret' }) }}
                className="ark-btn-ghost" style={{ flex: 1, fontSize: 12 }}>⚙️ Configurar</button>
              <button onClick={() => router.push('/admin/flow')} className="ark-btn-ghost" style={{ flex: 1, fontSize: 12 }}>🌿 Fluxo</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de configuração */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>⚙️ Configurar: {editing.name}</h3>

            {[
              { label: 'Nome do Bot', key: 'name' },
              { label: 'Mensagem de Boas-vindas', key: 'greeting', multiline: true },
              { label: 'Mensagem de Fallback', key: 'fallback_message', multiline: true, help: 'Quando o bot não entender a resposta' },
              { label: 'Palavra para atendimento humano', key: 'human_takeover_keyword', help: 'Ex: "humano" — transfere para atendente' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>{f.label.toUpperCase()}</label>
                {f.multiline ? (
                  <textarea value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    rows={3} className="ark-input" style={{ resize: 'vertical' }} />
                ) : (
                  <input value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="ark-input" />
                )}
                {f.help && <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>ℹ️ {f.help}</p>}
              </div>
            ))}

            <div style={{ borderTop: '1px solid rgba(79,142,247,0.1)', paddingTop: 16, marginTop: 6 }}>
              <p style={{ color: '#4f8ef7', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>🔗 META WHATSAPP BUSINESS API</p>
              {[
                { label: 'Phone Number ID', key: 'phone_number_id' },
                { label: 'Access Token', key: 'access_token', type: 'password' },
                { label: 'WABA ID', key: 'waba_id' },
                { label: 'Webhook Verify Token', key: 'webhook_verify_token' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>{f.label.toUpperCase()}</label>
                  <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className="ark-input" autoComplete="off" />
                </div>
              ))}
              <div style={{ background: '#12121f', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
                <p style={{ color: '#475569', fontSize: 11, marginBottom: 4 }}>URL do Webhook para configurar na Meta:</p>
                <code style={{ color: '#4f8ef7', fontSize: 11, wordBreak: 'break-all' }}>
                  {typeof window !== 'undefined' ? window.location.origin : 'https://SEU-APP.vercel.app'}/api/webhook/{editing.id}
                </code>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={saveBot} className="ark-btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setEditing(null)} className="ark-btn-ghost">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
