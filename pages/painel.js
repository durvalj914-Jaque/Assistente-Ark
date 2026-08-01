/**
 * /painel — Painel Arkiel de Administracao
 * Painel completo e centralizado para gestao de clientes, bots, conversas,
 * atividade do servidor e monitoramento em tempo real.
 * Acesso: apenas is_platform_admin = true.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../components/Layout/AdminLayout'
import { useTenant } from '../hooks/useTenant'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import NewClientModal from '../components/PlatformAdmin/NewClientModal'
import ClientCard from '../components/PlatformAdmin/ClientCard'
import HelpTip from '../components/HelpTip'

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

  if (loading || !user || !tenant || !profile?.is_platform_admin) return null

  const tabs = [
    { key: 'dashboard', icon: '\uD83D\uDCCA', label: 'Dashboard' },
    { key: 'clients',   icon: '\uD83C\uDFE2', label: 'Clientes' },
    { key: 'bots',      icon: '\uD83E\uDD16', label: 'Bots' },
    { key: 'activity',  icon: '\uD83D\uDCE0', label: 'Atividade' },
    { key: 'logs',      icon: '\uD83D\uDCCB', label: 'Logs do Servidor' },
  ]

  const filteredLogs = logFilter === 'all' ? logs : logFilter === 'error' ? logs.filter(l => l.error || l.status === 'error') : logs.filter(l => l.event_type === logFilter)

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <Head><title>Painel Arkiel — Administracao</title></Head>
      {showNewClient && <NewClientModal onClose={() => setShowNewClient(false)} onCreated={loadAll} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>Painel Arkiel</h1>
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
                <div key={bot.id} className="ark-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
