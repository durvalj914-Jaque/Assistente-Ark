import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'
import NotificationsCard from '../../components/NotificationsCard'

export default function SettingsPage() {
  const router = useRouter()
  const { user, tenant, role, profile, bots, loading } = useTenant()
  const [form, setForm] = useState({ name: '', slug: '' })
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviting, setInviting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectResult, setDisconnectResult] = useState(null)
  const [disconnectConfirm, setDisconnectConfirm] = useState('')

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark') }, [user, loading])

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('ark-theme') || 'dark' : 'dark'
    setTheme(saved)
  }, [])

  function toggleTheme(next) {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    if (typeof localStorage !== 'undefined') localStorage.setItem('ark-theme', next)
  }

  function loadMembers() {
    if (!tenant) return
    supabase.from('tenant_members').select('*, profiles:user_id(email)').eq('tenant_id', tenant.id).then(({ data }) => setMembers(data || []))
    supabase.from('tenant_invites').select('*').eq('tenant_id', tenant.id).is('accepted_at', null).then(({ data }) => setInvites(data || []))
  }

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name, slug: tenant.slug })
      loadMembers()
    }
  }, [tenant])

  async function handleDisconnect() {
    if (!bots || bots.length === 0) return
    const bot = bots[0]
    setDisconnecting(true)
    setDisconnectResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ bot_id: bot.id }),
      })
      const json = await res.json()
      setDisconnectResult(json)
      if (json.ok) {
        setShowDisconnect(false)
        setDisconnectConfirm('')
        // Atualizar a página após 2s
        setTimeout(() => router.reload(), 2000)
      }
    } catch (e) {
      setDisconnectResult({ ok: false, error: e.message })
    } finally { setDisconnecting(false) }
  }

  async function saveTenant() {
    await supabase.from('tenants').update({ name: form.name }).eq('id', tenant.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteMsg('')
    const email = inviteEmail.trim().toLowerCase()
    const { error } = await supabase.from('tenant_invites').insert({ tenant_id: tenant.id, email, role: 'member', invited_by: user.id })
    if (error) {
      setInviteMsg('❌ ' + error.message)
    } else {
      setInviteMsg(`✅ Convite criado. Quando ${email} entrar com Google usando esse e-mail, já cai direto na sua equipe.`)
      setInviteEmail('')
      loadMembers()
    }
    setInviting(false)
  }

  if (loading || !user || !tenant) return null
  const plan = PLANS[tenant.plan] || PLANS.free

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 20, marginBottom: 24 }}>⚙️ Configurações</h1>

      <NotificationsCard />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Empresa */}
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>🏢 Sua Empresa</h3>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>NOME DA EMPRESA</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="ark-input" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>SLUG (identificador único)</label>
            <input value={form.slug} disabled className="ark-input" style={{ opacity: 0.5 }} />
            <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>ℹ️ O slug não pode ser alterado</p>
          </div>
          <button onClick={saveTenant} className="ark-btn">{saved ? '✅ Salvo!' : 'Salvar'}</button>
        </div>

        {/* Plano */}
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>💎 Plano Atual</h3>
          <div style={{ background: 'linear-gradient(135deg, rgba(79,142,247,0.1), rgba(6,182,212,0.05))', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#4f8ef7', marginBottom: 4 }}>{plan.label}</div>
            <div style={{ color: '#64748b', fontSize: 13 }}>
              {plan.price ? `R$ ${plan.price}/mês` : plan.price === 0 ? 'Gratuito' : 'Sob consulta'}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {plan.features.map(f => (
                <div key={f} style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#10b981' }}>✓</span> {f}
                </div>
              ))}
            </div>
          </div>
          {tenant.plan !== 'enterprise' && (
            <a href="/admin/upgrade" className="ark-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              ⚡ Fazer upgrade
            </a>
          )}
        </div>

        {/* Membros */}
        <div className="ark-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>👥 Membros da equipe</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12121f', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ color: '#e2e8f0', fontSize: 13 }}>{m.profiles?.email || m.user_id}</div>
                <span className="ark-badge" style={{ background: m.role === 'owner' ? 'rgba(245,158,11,0.15)' : 'rgba(79,142,247,0.1)', color: m.role === 'owner' ? '#f59e0b' : '#4f8ef7', border: '1px solid transparent' }}>
                  {m.role}
                </span>
              </div>
            ))}
            {invites.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12121f', borderRadius: 8, padding: '10px 14px', opacity: 0.7 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13 }}>{i.email}</div>
                <span className="ark-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid transparent' }}>
                  ⏳ convite pendente
                </span>
              </div>
            ))}
          </div>
          {role === 'owner' || role === 'admin' ? (
            <div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="email@empresa.com" className="ark-input" style={{ maxWidth: 300 }} />
                <button disabled={inviting || !inviteEmail.trim()} className="ark-btn" style={{ whiteSpace: 'nowrap' }} onClick={sendInvite}>
                  {inviting ? 'Enviando…' : '+ Convidar'}
                </button>
              </div>
              <p style={{ color: '#334155', fontSize: 11, marginTop: 8 }}>ℹ️ A pessoa precisa entrar em arkiel.com.br com login do Google usando esse e-mail exato pra entrar na sua equipe automaticamente.</p>
              {inviteMsg && <p style={{ fontSize: 12, marginTop: 8, color: inviteMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{inviteMsg}</p>}
            </div>
          ) : null}
        </div>

        {/* Aparência */}
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 16, fontSize: 14 }}>🎨 Aparência</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 18 }}>Escolha o tema da interface. A preferência é salva neste navegador.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Escuro */}
            <button onClick={() => toggleTheme('dark')}
              style={{
                flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer',
                background: theme === 'dark' ? 'rgba(79,142,247,0.12)' : 'var(--bg-secondary)',
                border: theme === 'dark' ? '2px solid #4f8ef7' : '2px solid var(--border-soft)',
                transition: 'all 0.2s', textAlign: 'center',
              }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🌙</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Escuro</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Tema padrão</div>
            </button>
            {/* Claro */}
            <button onClick={() => toggleTheme('light')}
              style={{
                flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer',
                background: theme === 'light' ? 'rgba(79,142,247,0.12)' : 'var(--bg-secondary)',
                border: theme === 'light' ? '2px solid #4f8ef7' : '2px solid var(--border-soft)',
                transition: 'all 0.2s', textAlign: 'center',
              }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>☀️</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Claro</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Melhor para o dia</div>
            </button>
          </div>
          {/* Switch compacto */}
          <div style={{
            marginTop: 16, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Tema {theme === 'dark' ? 'Escuro' : 'Claro'}
              </span>
            </div>
            <div onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: theme === 'dark' ? '#4f8ef7' : 'rgba(0,0,0,0.15)',
                position: 'relative', transition: 'background 0.2s',
              }}>
              <div style={{
                position: 'absolute', top: 3, left: theme === 'dark' ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
        </div>

        {/* Conta */}
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 16, fontSize: 14 }}>👤 Minha Conta</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>E-mail: <b style={{ color: 'var(--text-primary)' }}>{user.email}</b></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 6 }}>Cargo: <b style={{ color: 'var(--text-primary)' }}>{role}</b></div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
            WhatsApp: <b style={{ color: bots?.[0]?.status === 'active' ? '#10b981' : 'var(--text-muted)' }}>
              {bots?.[0]?.status === 'active' ? '✅ Conectado' : '⛔ Desconectado'}
            </b>
          </div>

          {/* Botão Sair */}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginRight: 8 }}>
            Sair da conta
          </button>

          {/* Botão Descadastro WhatsApp */}
          {bots?.[0]?.status === 'active' && !showDisconnect && (
            <button onClick={() => setShowDisconnect(true)}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              🗑️ Descadastrar WhatsApp
            </button>
          )}

          {/* Modal de confirmação de descadastro */}
          {showDisconnect && (
            <div style={{
              marginTop: 16, padding: 20, borderRadius: 12,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <h4 style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>⚠️ Confirmar descadastro do WhatsApp</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                Ao descadastrar, seu número será <b>removido da plataforma Arkiel</b> e não receberá mais mensagens do bot.
                As conversas existentes serão <b>encerradas</b> (não deletadas — você pode reativar depois reconectando).
              </p>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>O que acontece:</div>
                <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
                  <li>Número desvinculado da Meta (WhatsApp Business)</li>
                  <li>Bot fica inativo</li>
                  <li>Conversas ativas são encerradas</li>
                  <li>Seus dados de conta permanecem intactos</li>
                </ul>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
                Para confirmar, digite <b style={{ color: 'var(--text-primary)' }}>DESCADASTRAR</b> abaixo:
              </p>
              <input
                value={disconnectConfirm}
                onChange={e => setDisconnectConfirm(e.target.value)}
                placeholder="DESCADASTRAR"
                className="ark-input"
                style={{ marginBottom: 12, borderColor: disconnectConfirm === 'DESCADASTRAR' ? '#ef4444' : 'var(--border-soft)' }}
              />
              {disconnectResult && (
                <div style={{
                  marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 12,
                  background: disconnectResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: disconnectResult.ok ? '#10b981' : '#ef4444',
                }}>
                  {disconnectResult.ok ? '✅ ' + disconnectResult.message : '❌ ' + (disconnectResult.error || 'Erro ao descadastrar')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDisconnect}
                  disabled={disconnecting || disconnectConfirm !== 'DESCADASTRAR'}
                  style={{
                    background: disconnectConfirm === 'DESCADASTRAR' ? '#ef4444' : 'rgba(239,68,68,0.3)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    padding: '8px 16px', cursor: (disconnecting || disconnectConfirm !== 'DESCADASTRAR') ? 'not-allowed' : 'pointer',
                    fontSize: 12, fontWeight: 600, opacity: (disconnecting || disconnectConfirm !== 'DESCADASTRAR') ? 0.5 : 1,
                  }}>
                  {disconnecting ? 'Descadastrando…' : 'Confirmar descadastro'}
                </button>
                <button onClick={() => { setShowDisconnect(false); setDisconnectConfirm(''); setDisconnectResult(null) }}
                  style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 8,
                    color: 'var(--text-secondary)', padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Mensagem quando WhatsApp já está desconectado */}
          {bots?.[0]?.status !== 'active' && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 10,
              background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)',
              fontSize: 12, color: 'var(--text-muted)',
            }}>
              📱 Seu WhatsApp está desconectado. Para reconectar, vá em <b style={{ color: 'var(--text-primary)' }}>Conectar WhatsApp</b> no menu.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
