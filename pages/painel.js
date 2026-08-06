/**
 * /painel — Painel Assistente Ark de Administracao
 * Painel completo e centralizado para gestao de clientes, bots, conversas,
 * atividade do servidor e monitoramento em tempo real.
 * Acesso: apenas is_platform_admin = true.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../components/Layout/AdminLayout'
import { useTenant } from '../hooks/useTenant'
import { supabase, supabaseAdmin } from '../lib/supabase'
import Head from 'next/head'
import NewClientModal from '../components/PlatformAdmin/NewClientModal'
import ClientCard from '../components/PlatformAdmin/ClientCard'
import HelpTip from '../components/HelpTip'
import BotEditorModal from '../components/PlatformAdmin/BotEditorModal'

export default function PainelAdminPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [tab, setTab] = useState('dashboard')
  const [showNewClient, setShowNewClient] = useState(false)

  const [stats, setStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)

  const [clients, setClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(true)

  const [allBots, setAllBots] = useState([])
  const [editingBot, setEditingBot] = useState(null)
  const [deregisterTarget, setDeregisterTarget] = useState(null)
  const [deregistering, setDeregistering] = useState(false)
  const [deregisterMsg, setDeregisterMsg] = useState('')
  const [contacts, setContacts] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [selectedTenantContacts, setSelectedTenantContacts] = useState('')
  const [syncingContacts, setSyncingContacts] = useState(false)
  const [contactsMsg, setContactsMsg] = useState('')
  const [loadingBots, setLoadingBots] = useState(true)

  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logFilter, setLogFilter] = useState('all')

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => { if (!loading && user && profile && !profile.is_platform_admin) router.replace('/admin') }, [loading, user, profile])

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') }
  }, [])

  async function loadAll() {
    setLoadingStats(true); setLoadingClients(true); setLoadingBots(true); setLoadingLogs(true)
    const h = await authHeader()
    const [clientsRes, logsRes] = await Promise.all([
      fetch('/api/admin/clients', { headers: h }).then(r => r.json()).catch(() => ({ clients: [] })),
      fetch('/api/admin/logs?limit=200', { headers: h }).then(r => r.json()).catch(() => ({ logs: [] }))
    ])

    const clientList = clientsRes.clients || []
    const logList = logsRes.logs || []
    const activeBots = clientList.filter(c => c.bots?.some(b => b.status === 'active')).length
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayLogs = logList.filter(l => (l.created_at || '').startsWith(todayStr))
    const errorLogs = logList.filter(l => l.status === 'error' || l.error)

    setStats({
      totalClients: clientList.length,
      activeBots,
      inactiveBots: clientList.length - activeBots,
      totalLogs: logList.length,
      todayLogs: todayLogs.length,
      errorLogs: errorLogs.length,
      totalMessages: clientList.reduce((sum, c) => sum + (c.bots?.reduce((s, b) => s + (b.total_messages || 0), 0) || 0), 0)
    })
    setRecentActivity(logList.slice(0, 15))
    setClients(clientList)
    const bots = clientList.flatMap(c =>
      (c.bots || []).map(b => ({ ...b, tenant_name: c.name, tenant_plan: c.plan, tenant_status: c.status }))
    )
    setAllBots(bots)
    setLogs(logList)
    setLoadingStats(false); setLoadingClients(false); setLoadingBots(false); setLoadingLogs(false)
  }

  useEffect(() => {
    if (!profile?.is_platform_admin) return
    loadAll()
  }, [profile])

  async function loadContacts(tenantId) {
    if (!tenantId) return
    const h = await authHeader()
    const res = await fetch('/api/contacts/list?tenant_id=' + tenantId, { headers: h }).then(r => r.json()).catch(() => ({ contacts: [] }))
    setContacts(res.contacts || [])
    if (res.needsInit) {
      setContactsMsg('⚠️ Tabela de contatos ainda não foi criada. Clique em "Inicializar" abaixo.')
    } else {
      setContactsMsg('')
    }
  }

  async function syncGoogleContacts() {
    if (!selectedTenantContacts) return
    setSyncingContacts(true)
    setContactsMsg('')
    try {
      const h = await authHeader()
      const res = await fetch('/api/contacts/sync-google', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: selectedTenantContacts })
      })
      const data = await res.json()
      if (res.ok) {
        setContactsMsg('✅ ' + data.synced + ' contatos sincronizados! (Total: ' + data.total_in_db + ')')
        loadContacts(selectedTenantContacts)
      } else {
        if (data.needsAuth) {
          setContactsMsg('⚠️ Google não conectado. Clique em "Conectar Google" para autorizar.')
        } else {
          setContactsMsg('❌ ' + (data.error || 'Erro ao sincronizar'))
        }
      }
    } catch (e) {
      setContactsMsg('❌ ' + e.message)
    }
    setSyncingContacts(false)
  }

  async function handleDeregister(bot) {
    setDeregistering(true)
    setDeregisterMsg('')
    try {
      const h = await authHeader()
      const res = await fetch('/api/admin/deregister-bot', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: bot.id })
      })
      const data = await res.json()
      if (res.ok) {
        setDeregisterMsg('✅ ' + (data.message || 'Descadastro concluído'))
        setDeregisterTarget(null)
        loadAll()
      } else {
        setDeregisterMsg('❌ ' + (data.error || 'Erro no descadastro'))
      }
    } catch (e) {
      setDeregisterMsg('❌ ' + e.message)
    }
    setDeregistering(false)
    setTimeout(() => setDeregisterMsg(''), 5000)
  }

  function connectGoogle() {
    if (!selectedTenantContacts) return
    window.location.href = '/api/contacts/google-auth?tenant_id=' + selectedTenantContacts
  }

  async function initContactsTable() {
    const h = await authHeader()
    const res = await fetch('/api/contacts/init-table', { method: 'POST', headers: h })
    const data = await res.json()
    if (res.ok) setContactsMsg('✅ ' + (data.message || 'Tabela criada'))
    else setContactsMsg('❌ ' + (data.error || 'Erro'))
  }

  // Detectar retorno do OAuth do Google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'contacts' && params.get('synced') === '1') {
      const tenant = params.get('tenant')
      if (tenant) setSelectedTenantContacts(tenant)
      setContactsMsg('✅ Google conectado! Clique em "Sincronizar Contatos" para importar.')
      // Limpar URL
      window.history.replaceState({}, '', '/painel')
    }
    if (params.get('tab') === 'contacts' && params.get('error')) {
      setContactsMsg('❌ ' + params.get('error'))
      window.history.replaceState({}, '', '/painel')
    }
  }, [])

  // Auto-selecionar primeiro tenant quando abrir a aba contatos
  useEffect(() => {
    if (clients.length && !selectedTenantContacts) setSelectedTenantContacts(clients[0].id)
  }, [clients])

  useEffect(() => {
    if (selectedTenantContacts) loadContacts(selectedTenantContacts)
  }, [selectedTenantContacts])

  if (loading || !user || !tenant || !profile?.is_platform_admin) return null

  const tabs = [
    { key: 'dashboard', icon: '\uD83D\uDCCA', label: 'Dashboard' },
    { key: 'clients',   icon: '\uD83C\uDFE2', label: 'Clientes' },
    { key: 'bots',      icon: '\uD83E\uDD16', label: 'Bots' },
    { key: 'contacts', icon: '\uD83D\uDC64', label: 'Contatos' },
    { key: 'payments', icon: '\uD83D\uDCB2', label: 'Pagamentos' },
    { key: 'receipts', icon: '\uD83D\uDCC4', label: 'Comprovantes' },
    { key: 'activity',  icon: '\uD83D\uDCE0', label: 'Atividade' },
    { key: 'logs',      icon: '\uD83D\uDCCB', label: 'Logs do Servidor' },
  ]

  const filteredLogs = logFilter === 'all' ? logs : logFilter === 'error' ? logs.filter(l => l.error || l.status === 'error') : logs.filter(l => l.event_type === logFilter)

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <Head><title>Painel Assistente Ark — Administracao</title></Head>
      {showNewClient && <NewClientModal onClose={() => setShowNewClient(false)} onCreated={loadAll} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>Painel Assistente Ark</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Controle total da plataforma — clientes, bots, atividade e servidor.</p>
        </div>
        {tab === 'clients' && (
          <button onClick={() => setShowNewClient(true)} className="ark-btn">+ Novo Cliente</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(79,142,247,0.1)', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid #4f8ef7' : '2px solid transparent',
              color: tab === t.key ? '#4f8ef7' : '#64748b',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div>
          {loadingStats ? (
            <p style={{ color: '#64748b' }}>Carregando estatisticas...</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                <StatTile label="Clientes" value={stats?.totalClients || 0} icon="\uD83C\uDFE2" sub={(stats?.activeBots || 0) + ' ativos'} />
                <StatTile label="Bots Ativos" value={stats?.activeBots || 0} icon="\uD83E\uDD16" sub={(stats?.inactiveBots || 0) + ' inativos'} />
                <StatTile label="Mensagens Hoje" value={stats?.todayLogs || 0} icon="\uD83D\uDCAC" sub={(stats?.totalLogs || 0) + ' total'} />
                <StatTile label="Erros" value={stats?.errorLogs || 0} icon="\u26A0\uFE0F" sub={stats?.errorLogs > 0 ? 'verificar!' : 'tudo ok'} danger={stats?.errorLogs > 0} />
              </div>

              <div className="ark-card">
                <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Atividade Recente</h3>
                {recentActivity.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: 13 }}>Nenhuma atividade registrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentActivity.map((log, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <span style={{ fontSize: 16 }}>{log.error ? '\uD83D\uDD34' : log.event_type === 'message_received' ? '\uD83D\uDCE8' : log.event_type === 'message_sent' ? '\uD83D\uDCE4' : '\u2699\uFE0F'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#e2e8f0', fontSize: 12 }}>{log.event_type || 'evento'} {log.contact_phone ? ' - ' + log.contact_phone : ''}</div>
                          <div style={{ color: '#334155', fontSize: 11 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</div>
                        </div>
                        {log.error && <span style={{ color: '#ef4444', fontSize: 11 }}>erro</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* CLIENTES */}
      {tab === 'clients' && (
        <div>
          {loadingClients ? (
            <p style={{ color: '#64748b' }}>Carregando...</p>
          ) : clients.length === 0 ? (
            <div className="ark-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#64748b', fontSize: 14 }}>Nenhuma empresa cadastrada ainda.</p>
              <button onClick={() => setShowNewClient(true)} className="ark-btn" style={{ marginTop: 16 }}>+ Criar primeiro cliente</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {clients.map(c => <ClientCard key={c.id} client={c} onChanged={loadAll} />)}
            </div>
          )}
        </div>
      )}

      {/* BOTS */}
      {tab === 'bots' && (
        <div>
          {loadingBots ? (
            <p style={{ color: '#64748b' }}>Carregando bots...</p>
          ) : allBots.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhum bot encontrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {allBots.map(bot => (
                <div key={bot.id} className="ark-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      background: bot.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)'
                    }}>
                      {bot.status === 'active' ? '\uD83D\uDFE2' : '\u2B55'}
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{bot.name}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                        {bot.tenant_name} {bot.phone_number_id ? ' - conectado' : ' - sem numero'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{bot.total_messages || 0}</div>
                      <div style={{ color: '#334155', fontSize: 10 }}>mensagens</div>
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: bot.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)',
                      color: bot.status === 'active' ? '#22c55e' : '#64748b'
                    }}>
                      {bot.status}
                    </span>
                    <button
                      onClick={() => setEditingBot(bot)}
                      className="ark-btn"
                      style={{ fontSize: 12, padding: '8px 16px' }}
                    >
                      ⚡ Editar fluxo
                    </button>
                    <button
                      onClick={() => { setDeregisterTarget(bot); setDeregisterMsg('') }}
                      className="ark-btn-ghost"
                      style={{ fontSize: 12, padding: '8px 14px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                      🗑️ Descadastrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {deregisterTarget && (
        <div onClick={() => !deregistering && setDeregisterTarget(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#12121f', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12,
            padding: 24, maxWidth: 440, width: '100%'
          }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>⚠️ Confirmar descadastro</h3>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Isso vai remover <strong style={{ color: '#fff' }}>{deregisterTarget.name}</strong> completamente:
            </p>
            <ul style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px', paddingLeft: 20 }}>
              <li>Desvincula o número da WhatsApp Cloud API (Meta)</li>
              <li>Deleta o bot, conversas e mensagens</li>
              <li>Remove o cliente (tenant) e dados sincronizados</li>
              <li>O número fica livre pra usar no WhatsApp normal</li>
            </ul>
            <p style={{ color: '#f59e0b', fontSize: 12, marginBottom: 16 }}>
              ⚠️ Esta ação é irreversível.
            </p>
            {deregisterMsg && (
              <p style={{ fontSize: 13, marginBottom: 12, color: deregisterMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
                {deregisterMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDeregisterTarget(null)}
                disabled={deregistering}
                className="ark-btn-ghost"
                style={{ fontSize: 13, padding: '10px 18px', flex: 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeregister(deregisterTarget)}
                disabled={deregistering}
                className="ark-btn"
                style={{ fontSize: 13, padding: '10px 18px', flex: 1, background: '#dc2626' }}
              >
                {deregistering ? '⏳ Descadastrando...' : '🗑️ Confirmar descadastro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBot && (
        <BotEditorModal
          bot={editingBot}
          tenantName={editingBot.tenant_name}
          onClose={() => setEditingBot(null)}
          onSaved={() => loadAll()}
        />
      )}

      {/* CONTATOS */}
      {tab === 'contacts' && (
        <div>
          {/* Barra de ações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <select
                value={selectedTenantContacts}
                onChange={e => setSelectedTenantContacts(e.target.value)}
                style={{
                  background: '#12121f', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8,
                  color: '#fff', padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                placeholder="🔍 Buscar contato..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                style={{
                  background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8,
                  color: '#fff', padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 220,
                }}
              />
              <span style={{ color: '#64748b', fontSize: 12 }}>{contacts.length} contatos</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={connectGoogle} className="ark-btn-ghost" style={{ fontSize: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🔵</span> Conectar Google
              </button>
              <button onClick={syncGoogleContacts} className="ark-btn" disabled={syncingContacts} style={{ fontSize: 12, padding: '8px 16px' }}>
                {syncingContacts ? '🔄 Sincronizando...' : '🔄 Sincronizar Contatos'}
              </button>
            </div>
          </div>

          {/* Mensagem de status */}
          {contactsMsg && (
            <div style={{
              padding: '10px 16px', marginBottom: 12, borderRadius: 8, fontSize: 13,
              background: contactsMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : contactsMsg.startsWith('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(79,142,247,0.1)',
              color: contactsMsg.startsWith('✅') ? '#22c55e' : contactsMsg.startsWith('❌') ? '#ef4444' : '#4f8ef7',
            }}>
              {contactsMsg}
            </div>
          )}

          {/* Lista de contatos */}
          {contacts.length === 0 ? (
            <div className="ark-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📇</div>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 8 }}>Nenhum contato sincronizado ainda</p>
              <p style={{ color: '#334155', fontSize: 12 }}>Selecione um cliente acima e clique em "Sincronizar Google" para importar contatos do Gmail.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {contacts
                .filter(c => {
                  if (!contactSearch) return true
                  const s = contactSearch.toLowerCase()
                  return (c.full_name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').includes(s)
                })
                .map(c => (
                  <div key={c.id} className="ark-card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, background: 'rgba(79,142,247,0.15)', color: '#4f8ef7',
                      }}>
                        {(c.full_name || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.full_name || 'Sem nome'}
                      </div>
                      {c.email && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✉️ {c.email}</div>}
                      {c.phone && <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>📱 {c.phone}</div>}
                      {c.organization && <div style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>🏢 {c.organization}{c.job_title ? ' · ' + c.job_title : ''}</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ATIVIDADE */}
      {tab === 'activity' && (
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Atividade do Servidor</h3>
          {loadingStats ? (
            <p style={{ color: '#64748b' }}>Carregando...</p>
          ) : recentActivity.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 13 }}>Nenhuma atividade registrada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActivity.map((log, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8,
                  background: log.error ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid ' + (log.error ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)')
                }}>
                  <span style={{ fontSize: 14 }}>{log.error ? '\uD83D\uDD34' : '\uD83D\uDFE2'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>{log.event_type || 'evento'}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                      {log.contact_phone || log.bot_name || '-'} {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                    {log.error && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{log.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LOGS */}
      {tab === 'logs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            {['all', 'error', 'message_received', 'message_sent', 'bot_response'].map(s => (
              <button key={s} onClick={() => setLogFilter(s)}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: '1px solid ' + (logFilter === s ? '#4f8ef7' : 'rgba(255,255,255,0.08)'),
                  background: logFilter === s ? 'rgba(79,142,247,0.15)' : 'transparent',
                  color: logFilter === s ? '#4f8ef7' : '#64748b'
                }}>
                {s === 'all' ? 'Todos' : s === 'error' ? 'Erros' : s.replace(/_/g, ' ')}
                {s !== 'all' && ' (' + (s === 'error' ? logs.filter(l => l.error || l.status === 'error') : logs.filter(l => l.event_type === s)).length + ')'}
              </button>
            ))}
            <HelpTip text="Logs do webhook mostram cada evento recebido da Meta (mensagens, status de entrega, erros). Util para diagnosticar problemas." />
          </div>

          {loadingLogs ? (
            <p style={{ color: '#64748b' }}>Carregando logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p style={{ color: '#64748b' }}>Nenhum log encontrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredLogs.slice(0, 100).map((log, i) => (
                <div key={i} className="ark-card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: log.error ? 'rgba(239,68,68,0.15)' : 'rgba(79,142,247,0.1)',
                        color: log.error ? '#ef4444' : '#4f8ef7'
                      }}>
                        {log.event_type || 'event'}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 10 }}>{log.contact_phone || ''}</span>
                    </div>
                    <span style={{ color: '#334155', fontSize: 11 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {log.error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>{log.error}</div>}
                  {log.response && <div style={{ color: '#64748b', fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>{'-> '}{log.response}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── ABA PAGAMENTOS ── */}
      {tab === 'payments' && (
        <div>
          <div className="ark-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>💰 Configuração de Pagamentos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>Chave PIX</label>
                <input value={payConfig.pix_key} onChange={e => setPayConfig(c => ({ ...c, pix_key: e.target.value }))} placeholder="ex: arkieltech@gmail.com"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>Nome do Recebedor</label>
                <input value={payConfig.merchant_name} onChange={e => setPayConfig(c => ({ ...c, merchant_name: e.target.value }))} placeholder="ex: Arkiel Tech"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>Cidade</label>
                <input value={payConfig.merchant_city} onChange={e => setPayConfig(c => ({ ...c, merchant_city: e.target.value }))} placeholder="ex: SAO PAULO"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>Token Mercado Pago (opcional)</label>
                <input value={payConfig.mp_access_token} onChange={e => setPayConfig(c => ({ ...c, mp_access_token: e.target.value }))} placeholder="APP_USR-..." type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, marginTop: 4 }} />
              </div>
            </div>
            <button onClick={savePayConfig} disabled={savingPayConfig}
              style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: savingPayConfig ? 0.5 : 1 }}>
              {savingPayConfig ? 'Salvando...' : '💾 Salvar Configuração'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatTile label="Total Recebido" value={'R$ ' + (payments.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(p.amount), 0)).toFixed(2)} icon="✅" />
            <StatTile label="Pendentes" value={'R$ ' + (payments.filter(p => p.status === 'pending').reduce((s, p) => s + parseFloat(p.amount), 0)).toFixed(2)} icon="⏳" />
            <StatTile label="Pagamentos" value={payments.length} icon="📊" />
          </div>

          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Histórico de Pagamentos</h3>
          {loadingPayments ? (
            <p style={{ color: '#64748b' }}>Carregando...</p>
          ) : payments.length === 0 ? (
            <div className="ark-card" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💸</div>
              Nenhum pagamento ainda. Quando você enviar um PIX ou link de pagamento pelo chat, ele aparece aqui.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map(p => (
                <div key={p.id} className="ark-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{p.method === 'pix' ? '💠' : '💳'}</span>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>R$ {parseFloat(p.amount).toFixed(2)}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: p.status === 'paid' ? 'rgba(34,197,94,0.15)' : p.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: p.status === 'paid' ? '#22c55e' : p.status === 'pending' ? '#f59e0b' : '#ef4444'
                      }}>
                        {p.status === 'paid' ? '✅ Pago' : p.status === 'pending' ? '⏳ Pendente' : '❌ ' + p.status}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                      {p.description || 'Pagamento'} • {new Date(p.created_at).toLocaleString('pt-BR')}
                      {p.paid_at && ' • Pago em ' + new Date(p.paid_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {p.pix_code && (
                    <button onClick={() => navigator.clipboard.writeText(p.pix_code)} title="Copiar código PIX"
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#4f8ef7', fontSize: 11, cursor: 'pointer' }}>
                      📋 Copiar PIX
                    </button>
                  )}
                  {p.mp_checkout_url && (
                    <a href={p.mp_checkout_url} target="_blank" rel="noopener"
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#4f8ef7', fontSize: 11, textDecoration: 'none' }}>
                      🔗 Ver link
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA COMPROVANTES ── */}
      {tab === 'receipts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>📄 Comprovantes de Pagamento</h3>
            <button onClick={() => { setReceiptModal(true); loadPayments() }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Enviar Comprovante
            </button>
          </div>

          {loadingReceipts ? (
            <p style={{ color: '#64748b' }}>Carregando...</p>
          ) : receipts.length === 0 ? (
            <div className="ark-card" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              Nenhum comprovante enviado. Clique em "Enviar Comprovante" para adicionar.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {receipts.map(r => (
                <div key={r.id} className="ark-card" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: 18 }}>{r.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                      {r.payments && (
                        <span style={{
                          marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: r.payments.status === 'paid' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                          color: r.payments.status === 'paid' ? '#22c55e' : '#f59e0b'
                        }}>
                          {r.payments.status === 'paid' ? '✅ Confirmado' : '⏳ Pendente'}
                        </span>
                      )}
                    </div>
                    <button onClick={() => deleteReceipt(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                  {r.payments && parseFloat(r.payments.amount) > 0 && (
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      R$ {parseFloat(r.payments.amount).toFixed(2)} — {r.payments.description || 'Pagamento'}
                    </div>
                  )}
                  {r.payments && parseFloat(r.payments.amount) === 0 && r.metadata?.avulso && (
                    <div style={{ color: '#a78bfa', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {r.notes || 'Comprovante avulso'}
                    </div>
                  )}
                  {r.file_type === 'pdf' ? (
                    <a href={r.file_url} target="_blank" rel="noopener" style={{ color: '#4f8ef7', fontSize: 12, textDecoration: 'none' }}>📎 Ver comprovante (PDF)</a>
                  ) : (
                    <a href={r.file_url} target="_blank" rel="noopener">
                      <img src={r.file_url} alt="Comprovante" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', cursor: 'pointer' }} />
                    </a>
                  )}
                  {r.notes && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 8 }}>📝 {r.notes}</div>}
                  <div style={{ color: '#334155', fontSize: 10, marginTop: 6 }}>
                    {r.uploaded_by} • {new Date(r.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal de upload de comprovante */}
          {receiptModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                 onClick={() => setReceiptModal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d1e', borderRadius: 16, padding: 24, maxWidth: 420, width: '90%', border: '1px solid rgba(79,142,247,0.25)' }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📄 Enviar Comprovante</h3>

                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Associar a pagamento (opcional)</label>
                <select value={receiptPaymentId} onChange={e => setReceiptPaymentId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, marginBottom: 12 }}>
                  <option value="">Sem vínculo</option>
                  {payments.filter(p => p.status === 'pending').map(p => (
                    <option key={p.id} value={p.id}>R$ {parseFloat(p.amount).toFixed(2)} — {p.description || 'Pagamento'} ({p.method})</option>
                  ))}
                </select>
                {receiptPaymentId && (
                  <p style={{ color: '#22c55e', fontSize: 11, marginBottom: 12 }}>
                    ✓ O pagamento selecionado será marcado como "Pago" automaticamente.
                  </p>
                )}

                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Observações (opcional)</label>
                <input value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} placeholder="Ex: PIX pago em 06/08"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, marginBottom: 16 }} />

                <label style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Arquivo (imagem ou PDF)</label>
                <input type="file" accept="image/*,application/pdf" id="receipt-file" style={{ width: '100%', color: '#94a3b8', fontSize: 13, marginBottom: 16 }} />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setReceiptModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => { const f = document.getElementById('receipt-file').files[0]; if (f) uploadReceipt(f); else alert('Selecione um arquivo') }}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Enviar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </AdminLayout>
  )
}

function StatTile({ label, value, icon, sub, danger }) {
  return (
    <div className="ark-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ color: danger ? '#ef4444' : '#fff', fontWeight: 800, fontSize: 28 }}>{value}</div>
      <div style={{ color: danger ? '#ef4444' : '#334155', fontSize: 11, marginTop: 4 }}>{sub}</div>
    </div>
  )
}
