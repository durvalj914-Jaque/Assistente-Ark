import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import PlatformTutorial from '../../components/PlatformTutorial'
import NewClientModal from '../../components/PlatformAdmin/NewClientModal'
import ClientCard from '../../components/PlatformAdmin/ClientCard'
import HelpTip from '../../components/HelpTip'

const STATUS_OPTS = ['pending', 'in_progress', 'connected', 'rejected']

function ResolveForm({ req, onDone }) {
  const [adminNotes, setAdminNotes] = useState(req.admin_notes || '')
  const [status, setStatus] = useState(req.status)
  const [saving, setSaving] = useState(false)

  async function saveStatus() {
    setSaving(true)
    await supabase.from('whatsapp_onboarding_requests').update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() }).eq('id', req.id)
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ color: '#64748b', fontSize: 11.5 }}>
        Pra conectar o WhatsApp de verdade, use a aba <b style={{ color: '#94a3b8' }}>🏢 Clientes</b> acima → "Gerenciar" na empresa <b style={{ color: '#94a3b8' }}>{req.tenants?.name}</b>. Aqui você só atualiza o status desse pedido.
      </p>
      <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={2} placeholder="Nota interna (visível ao cliente)"
        style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} className="ark-input" style={{ fontSize: 12, maxWidth: 160 }}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button disabled={saving} onClick={saveStatus} className="ark-btn" style={{ fontSize: 12, padding: '8px 14px' }}>Salvar status</button>
      </div>
    </div>
  )
}

export default function PlatformAdminPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [tab, setTab] = useState('clients')
  const [showTutorial, setShowTutorial] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)

  const [requests, setRequests] = useState([])
  const [loadingReqs, setLoadingReqs] = useState(true)
  const [filter, setFilter] = useState('pending')

  const [clients, setClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(true)

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])
  useEffect(() => { if (!loading && user && profile && !profile.is_platform_admin) router.replace('/admin') }, [loading, user, profile])

  async function loadRequests() {
    setLoadingReqs(true)
    const { data } = await supabase.from('whatsapp_onboarding_requests').select('*, tenants(name)').order('created_at', { ascending: false })
    setRequests(data || [])
    setLoadingReqs(false)
  }

  async function loadClients() {
    setLoadingClients(true)
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin/clients', { headers: { Authorization: `Bearer ${session?.access_token || ''}` } })
    const data = await r.json()
    setClients(data.clients || [])
    setLoadingClients(false)
  }

  useEffect(() => {
    if (!profile?.is_platform_admin) return
    loadRequests()
    loadClients()
  }, [profile])

  if (loading || !user || !tenant || !profile?.is_platform_admin) return null

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingReqCount = requests.filter(r => r.status === 'pending').length

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      {showTutorial && <PlatformTutorial onClose={() => setShowTutorial(false)} />}
      {showNewClient && <NewClientModal onClose={() => setShowNewClient(false)} onCreated={loadClients} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>🛠️ Painel Arkiel</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Visível só pra equipe Arkiel — gerencie todas as empresas clientes da plataforma.</p>
        </div>
        <button onClick={() => setShowTutorial(true)} className="ark-btn-ghost">🧭 Como usar</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid rgba(79,142,247,0.1)' }}>
        <button onClick={() => setTab('clients')}
          style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === 'clients' ? '2px solid #4f8ef7' : '2px solid transparent',
            color: tab === 'clients' ? '#4f8ef7' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          🏢 Clientes ({clients.length})
        </button>
        <button onClick={() => setTab('requests')}
          style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: tab === 'requests' ? '2px solid #4f8ef7' : '2px solid transparent',
            color: tab === 'requests' ? '#4f8ef7' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          📋 Pedidos de conexão WhatsApp {pendingReqCount > 0 && `(${pendingReqCount})`}
        </button>
      </div>

      {tab === 'clients' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowNewClient(true)} className="ark-btn">+ Novo Cliente</button>
          </div>
          {loadingClients ? (
            <p style={{ color: '#64748b' }}>Carregando...</p>
          ) : clients.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {clients.map(c => <ClientCard key={c.id} client={c} onChanged={loadClients} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            {['pending', 'in_progress', 'connected', 'rejected', 'all'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: `1px solid ${filter === s ? '#4f8ef7' : 'rgba(255,255,255,0.08)'}`,
                  background: filter === s ? 'rgba(79,142,247,0.15)' : 'transparent',
                  color: filter === s ? '#4f8ef7' : '#64748b' }}>
                {s} {s !== 'all' ? `(${requests.filter(r => r.status === s).length})` : `(${requests.length})`}
              </button>
            ))}
            <HelpTip text="Pedidos que clientes já cadastrados enviam quando querem conectar o número deles. Pra conectar de verdade, use a aba Clientes." />
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
                  <ResolveForm req={req} onDone={loadRequests} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
