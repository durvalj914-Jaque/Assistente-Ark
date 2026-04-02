import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'

export default function SettingsPage() {
  const router = useRouter()
  const { user, tenant, role, loading } = useTenant()
  const [form, setForm] = useState({ name: '', slug: '' })
  const [members, setMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name, slug: tenant.slug })
      supabase.from('tenant_members').select('*, profiles:user_id(email)').eq('tenant_id', tenant.id).then(({ data }) => setMembers(data || []))
    }
  }, [tenant])

  async function saveTenant() {
    await supabase.from('tenants').update({ name: form.name }).eq('id', tenant.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading || !user || !tenant) return null
  const plan = PLANS[tenant.plan] || PLANS.free

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 24 }}>⚙️ Configurações</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Empresa */}
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>🏢 Sua Empresa</h3>
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
          <h3 style={{ color: '#fff', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>💎 Plano Atual</h3>
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
          <h3 style={{ color: '#fff', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>👥 Membros da equipe</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12121f', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ color: '#e2e8f0', fontSize: 13 }}>{m.profiles?.email || m.user_id}</div>
                <span className="ark-badge" style={{ background: m.role === 'owner' ? 'rgba(245,158,11,0.15)' : 'rgba(79,142,247,0.1)', color: m.role === 'owner' ? '#f59e0b' : '#4f8ef7', border: '1px solid transparent' }}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
          {role === 'owner' || role === 'admin' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@empresa.com" className="ark-input" style={{ maxWidth: 300 }} />
              <button className="ark-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => alert('Convite enviado! (integre com e-mail)')}>
                + Convidar
              </button>
            </div>
          ) : null}
        </div>

        {/* Conta */}
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, marginBottom: 16, fontSize: 14 }}>👤 Minha Conta</h3>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>E-mail: <b style={{ color: '#e2e8f0' }}>{user.email}</b></div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>Cargo: <b style={{ color: '#e2e8f0' }}>{role}</b></div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Sair da conta
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}
