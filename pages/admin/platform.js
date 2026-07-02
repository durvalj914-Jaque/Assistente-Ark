import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

const STATUS_OPTS = ['pending', 'in_progress', 'connected', 'rejected']

function ResolveForm({ req, onDone }) {
  const [phoneId, setPhoneId] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [token, setToken] = useState('')
  const [adminNotes, setAdminNotes] = useState(req.admin_notes || '')
  const [status, setStatus] = useState(req.status)
  const [saving, setSaving] = useState(false)

  async function saveStatus() {
    setSaving(true)
    await supabase.from('whatsapp_onboarding_requests').update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq('id', req.id)
    setSaving(false)
    onDone()
  }

  async function connectBot() {
    if (!phoneId || !token) { alert('Preencha ao menos o Phone Number ID e o Access Token.'); return }
    setSaving(true)
    // acha (ou cria) um bot pra esse tenant e liga o numero
    const { data: existingBots } = await supabase.from('bots').select('id').eq('tenant_id', req.tenant_id).order('created_at').limit(1)
    if (existingBots?.length) {
      await supabase.from('bots').update({ phone_number_id: phoneId, waba_id: wabaId, access_token: token, status: 'active' }).eq('id', existingBots[0].id)
    } else {
      await supabase.from('bots').insert({ tenant_id: req.tenant_id, name: 'Meu Bot', phone_number_id: phoneId, waba_id: wabaId, access_token: token, status: 'active' })
    }
    await supabase.from('whatsapp_onboarding_requests').update({ status: 'connected', admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq('id', req.id)
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={phoneId} onChange={e => setPhoneId(e.target.value)} placeholder="Phone Number ID (Meta)" className="ark-input" style={{ fontSize: 12 }} />
        <input value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="WABA ID" className="ark-input" style={{ fontSize: 12 }} />
      </div>
      <input value={token} onChange={e => setToken(e.target.value)} placeholder="Access Token permanente" className="ark-input" style={{ fontSize: 12 }} />
      <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Nota interna (visível ao cliente)"
        style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} className="ark-input" style={{ fontSize: 12, maxWidth: 160 }}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button disabled={saving} onClick={saveStatus} className="ark-btn" style={{ fontSize: 12, padding: '8px 14px' }}>Salvar status</button>
        <button disabled={saving} onClick={connectBot} className="ark-btn" style={{ fontSize: 12, padding: '8px 14px', background: 'linear-gradient(135deg,#10b981,#059669)' }}>⚡ Conectar bot agora</button>
      </div>
    </div>
  )
}

export default function PlatformAdminPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [requests, setRequests] = useState([])
  const [loadingReqs, setLoadingReqs] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => { if (!loading && user && profile && !profile.is_platform_admin) router.replace('/admin') }, [loading, user, profile])

  async function load() {
    setLoadingReqs(true)
    const { data } = await supabase.from('whatsapp_onboarding_requests').select('*, tenants(name)').order('created_at', { ascending: false })
    setRequests(data || [])
    setLoadingReqs(false)
  }

  useEffect(() => { if (profile?.is_platform_admin) load() }, [profile])

  if (loading || !user || !tenant || !profile?.is_platform_admin) return null

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>🛠️ Painel Arkiel — Pedidos de WhatsApp</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Visível só pra equipe Arkiel. Aqui entram todos os pedidos de conexão de WhatsApp de todos os clientes.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['pending', 'in_progress', 'connected', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              border: `1px solid ${filter === s ? '#4f8ef7' : 'rgba(255,255,255,0.08)'}`,
              background: filter === s ? 'rgba(79,142,247,0.15)' : 'transparent',
              color: filter === s ? '#4f8ef7' : '#64748b' }}>
            {s} {s !== 'all' ? `(${requests.filter(r => r.status === s).length})` : `(${requests.length})`}
          </button>
        ))}
      </div>

      {loadingReqs ? (
        <p style={{ color: '#64748b' }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#64748b' }}>Nenhum pedido nesse status. 🎉</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(req => (
            <div key={req.id} className="ark-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{req.business_name} <span style={{ color: '#4f8ef7', fontWeight: 500 }}>· {req.tenants?.name}</span></div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>📱 {req.whatsapp_number} &nbsp;·&nbsp; ✉️ {req.contact_email}</div>
                  {req.notes && <div style={{ color: '#64748b', fontSize: 12, marginTop: 6, fontStyle: 'italic' }}>"{req.notes}"</div>}
                  <div style={{ color: '#334155', fontSize: 11, marginTop: 6 }}>{new Date(req.created_at).toLocaleString('pt-BR')} · confirmado disponível: {req.confirmed_available ? 'sim ✅' : 'não ⚠️'}</div>
                </div>
                <span className="ark-badge" style={{ background: 'rgba(79,142,247,0.1)', color: '#4f8ef7', border: '1px solid transparent', whiteSpace: 'nowrap' }}>{req.status}</span>
              </div>
              <ResolveForm req={req} onDone={load} />
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}
