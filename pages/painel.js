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
  const [uploadingContacts, setUploadingContacts] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [loadingBots, setLoadingBots] = useState(true)

  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logFilter, setLogFilter] = useState('all')

  // ── Payments ──
  const [payConfig, setPayConfig] = useState({ pix_key: '', merchant_name: '', merchant_city: '', mp_access_token: '' })
  const [savingPayConfig, setSavingPayConfig] = useState(false)
  const [payments, setPayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  // ── Fee Config (taxas por método) ──
  const [feeConfig, setFeeConfig] = useState({ pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 })
  const [savingFees, setSavingFees] = useState(false)
  const [feeMsg, setFeeMsg] = useState('')
  const [plans, setPlans] = useState([])
  const [planModal, setPlanModal] = useState(null) // null | 'new' | {editing plan}
  const [planForm, setPlanForm] = useState({ name: '', price: '', billing_cycle: 'monthly', duration_days: '', description: '', features: '', resource_ids: [] })
  const [planSaving, setPlanSaving] = useState(false)
  const [resources, setResources] = useState([])
  const [resourceModal, setResourceModal] = useState(null) // null | 'new' | {editing}
  const [resourceForm, setResourceForm] = useState({ name: '', price: '', description: '', category: 'geral' })
  const [resourceSaving, setResourceSaving] = useState(false)
  const [mpDiag, setMpDiag] = useState(null)
  const [mpDiagLoading, setMpDiagLoading] = useState(false)
  const [mpClearing, setMpClearing] = useState(false)

  // ── Receipts ──
  const [receipts, setReceipts] = useState([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [receiptCategory, setReceiptCategory] = useState('all')
  const [editingReceipt, setEditingReceipt] = useState(null)
  const [receiptModal, setReceiptModal] = useState(false)
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptAmount, setReceiptAmount] = useState('')
  const [wabaNumbers, setWabaNumbers] = useState([])
  const [loadingWabaNumbers, setLoadingWabaNumbers] = useState(false)
  const [migrateNumber, setMigrateNumber] = useState('')
  const [migrateTenant, setMigrateTenant] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [migrateMsg, setMigrateMsg] = useState('')

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
    loadPayConfig()
    loadFeeConfig()
  }, [profile])

  useEffect(() => {
    if (tab === 'payments') { loadPayments() }
    if (tab === 'receipts') { loadReceipts('all') }
    if (tab === 'planos') { loadPlans(); loadResources() }
  }, [tab])

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

  async function uploadContactsFile(files, tenantId) {
    if (!files || !files.length) return
    if (!tenantId) { setContactsMsg('❌ Selecione um cliente primeiro'); return }
    setUploadingContacts(true)
    setContactsMsg('')
    setUploadResult(null)
    try {
      const h = await authHeader()
      let totalImported = 0, totalSkipped = 0, totalErrors = 0, totalProcessed = 0
      let lastErrorMessages = null

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('tenant_id', tenantId)

        const res = await fetch('/api/contacts/import-device', {
          method: 'POST',
          headers: { Authorization: h.Authorization },
          body: formData,
        })
        const json = await res.json()
        if (json.ok) {
          totalImported += json.imported || 0
          totalSkipped += json.skipped || 0
          totalErrors += json.errors || 0
          totalProcessed += json.total || 0
          if (json.errorMessages) lastErrorMessages = json.errorMessages
        } else {
          lastErrorMessages = lastErrorMessages || []
          lastErrorMessages.push(json.error || 'erro')
          console.error('Upload error for', file.name, ':', json.error)
        }
      }

      setUploadResult({ imported: totalImported, skipped: totalSkipped, errors: totalErrors, total: totalProcessed })
      if (totalErrors > 0 && totalImported === 0) {
        const errMsg = lastErrorMessages && lastErrorMessages.length ? lastErrorMessages.join(' | ') : 'erro desconhecido'
        setContactsMsg('❌ ' + totalErrors + ' erros ao importar. Detalhe: ' + errMsg)
      } else if (totalErrors > 0) {
        const errMsg = lastErrorMessages && lastErrorMessages.length ? lastErrorMessages.join(' | ') : 'erro desconhecido'
        setContactsMsg(`✅ ${totalImported} importados! ${totalSkipped} duplicados. ⚠️ ${totalErrors} erros: ${errMsg}`)
      } else {
        setContactsMsg(`✅ ${totalImported} contatos importados! ${totalSkipped} duplicados ignorados.`)
      }
      loadContacts(tenantId)
    } catch (e) {
      setContactsMsg('❌ Erro no upload: ' + e.message)
    }
    setUploadingContacts(false)
  }

  async function loadPayConfig() {
    const h = await authHeader()
    try {
      const res = await fetch('/api/payments/config', { headers: h })
      const json = await res.json()
      if (json.config) {
        setPayConfig({
          pix_key: json.config.pix_key || '',
          merchant_name: json.config.merchant_name || '',
          merchant_city: json.config.merchant_city || '',
          mp_access_token: json.config.mp_access_token || '',
        })
      }
    } catch (e) { console.error('loadPayConfig', e) }
  }

  async function savePayConfig() {
    setSavingPayConfig(true)
    try {
      const h = await authHeader()
      await fetch('/api/payments/config', { method: 'POST', headers: h, body: JSON.stringify(payConfig) })
      setFeeMsg('✅ Configurações salvas!')
      setTimeout(() => setFeeMsg(''), 2500)
    } catch (e) { setFeeMsg('❌ ' + e.message) }
    finally { setSavingPayConfig(false) }
  }

  async function loadPayments() {
    setLoadingPayments(true)
    try {
      const h = await authHeader()
      const res = await fetch('/api/payments/list', { headers: h })
      const json = await res.json()
      if (json.payments) setPayments(json.payments)
    } catch (e) {}
    finally { setLoadingPayments(false) }
  }

  async function loadFeeConfig() {
    const h = await authHeader()
    try {
      const res = await fetch('/api/admin/fee-config', { headers: h })
      const json = await res.json()
      if (json.fee_config) setFeeConfig(json.fee_config)
    } catch (e) { console.error('loadFeeConfig', e) }
  }

  async function loadPlans() {
    try {
      const h = await authHeader()
      const res = await fetch('/api/admin/plans', { headers: h })
      const json = await res.json()
      if (json.plans) setPlans(json.plans)
    } catch (e) { console.error('loadPlans', e) }
  }

  async function loadResources() {
    try {
      const h = await authHeader()
      const res = await fetch('/api/admin/plan-resources', { headers: h })
      const json = await res.json()
      if (json.resources) setResources(json.resources)
    } catch (e) { console.error('loadResources', e) }
  }

  async function saveResource(isEdit) {
    setResourceSaving(true)
    try {
      const h = await authHeader()
      const body = {
        name: resourceForm.name,
        price: parseFloat(resourceForm.price) || 0,
        description: resourceForm.description,
        category: resourceForm.category,
      }
      const res = await fetch('/api/admin/plan-resources', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: resourceModal.id, ...body } : body)
      })
      const json = await res.json()
      if (json.ok) {
        setResourceModal(null)
        setResourceForm({ name: '', price: '', description: '', category: 'geral' })
        loadResources()
      } else {
        alert('Erro: ' + (json.error || 'Desconhecido'))
      }
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setResourceSaving(false) }
  }

  async function deleteResource(id) {
    if (!confirm('Excluir este recurso?')) return
    try {
      const h = await authHeader()
      await fetch('/api/admin/plan-resources', { method: 'DELETE', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      loadResources()
    } catch (e) {}
  }

  function toggleResourceInPlan(resId) {
    setPlanForm(prev => {
      const ids = prev.resource_ids || []
      const has = ids.includes(resId)
      const newIds = has ? ids.filter(x => x !== resId) : [...ids, resId]
      // Auto-calc price from selected resources
      const sum = newIds.reduce((acc, rid) => {
        const r = resources.find(x => x.id === rid)
        return acc + (r ? r.price : 0)
      }, 0)
      return { ...prev, resource_ids: newIds, price: sum > 0 ? String(sum.toFixed(2)) : prev.price }
    })
  }

  async function savePlan(isEdit) {
    setPlanSaving(true)
    try {
      const h = await authHeader()
      const features = planForm.features ? planForm.features.split('\n').filter(f => f.trim()) : []
      const body = {
        name: planForm.name,
        price: parseFloat(planForm.price) || 0,
        billing_cycle: planForm.billing_cycle,
        duration_days: planForm.duration_days ? parseInt(planForm.duration_days) : null,
        description: planForm.description,
        features,
      }
      const res = await fetch('/api/admin/plans', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: planModal.id, ...body } : body)
      })
      const json = await res.json()
      if (json.ok) {
        setPlanModal(null)
        setPlanForm({ name: '', price: '', billing_cycle: 'monthly', duration_days: '', description: '', features: '' })
        loadPlans()
      } else {
        alert('Erro: ' + (json.error || 'Desconhecido'))
      }
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setPlanSaving(false) }
  }

  async function deletePlan(id) {
    if (!confirm('Confirmar exclusão deste plano?')) return
    try {
      const h = await authHeader()
      const res = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const json = await res.json()
      if (json.ok) loadPlans()
      else alert('Erro: ' + (json.error || 'Desconhecido'))
    } catch (e) { alert('Erro: ' + e.message) }
  }

  async function togglePlanActive(plan) {
    try {
      const h = await authHeader()
      await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, active: !plan.active })
      })
      loadPlans()
    } catch (e) {}
  }

  async function saveFeeConfig() {
    setSavingFees(true)
    setFeeMsg('')
    try {
      const h = await authHeader()
      // Ensure values are numbers
      const cleanConfig = {}
      for (const [k, v] of Object.entries(feeConfig)) {
        cleanConfig[k] = parseFloat(v) || 0
      }
      const res = await fetch('/api/admin/fee-config', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ fee_config: cleanConfig })
      })
      const json = await res.json()
      if (json.ok) {
        setFeeConfig(json.fee_config || cleanConfig)
        setFeeMsg('✅ Taxas salvas! Armazenado em: ' + (json.stored_in || 'banco'))
        setTimeout(() => setFeeMsg(''), 4000)
      } else {
        setFeeMsg('❌ ' + (json.error || 'Erro ao salvar'))
        console.error('[saveFeeConfig] Error:', json)
      }
    } catch (e) {
      setFeeMsg('❌ ' + e.message)
      console.error('[saveFeeConfig] Exception:', e)
    }
    finally { setSavingFees(false) }
  }

  async function runMpDiagnostic() {
    setMpDiagLoading(true)
    setMpDiag(null)
    try {
      const h = await authHeader()
      const res = await fetch('/api/admin/mp-diagnostic', { headers: h })
      const json = await res.json()
      setMpDiag(json)
    } catch (e) { setMpDiag({ error: e.message }) }
    finally { setMpDiagLoading(false) }
  }

  async function clearMpFromTenant(tenantId, tenantName) {
    if (!confirm('Confirma remover o Mercado Pago do tenant: ' + tenantName + '?')) return
    setMpClearing(true)
    try {
      const h = await authHeader()
      const res = await fetch('/api/admin/mp-diagnostic', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_tenant_id: tenantId })
      })
      const json = await res.json()
      if (json.ok) {
        alert('✅ MP removido do tenant: ' + tenantName)
        runMpDiagnostic() // refresh
      } else {
        alert('❌ ' + (json.error || 'Erro'))
      }
    } catch (e) { alert('❌ ' + e.message) }
    finally { setMpClearing(false) }
  }

  async function loadWabaNumbers() {
    setLoadingWabaNumbers(true)
    try {
      const h = await authHeader()
      const res = await fetch('/api/whatsapp/list-numbers', { headers: h })
      const json = await res.json()
      if (json.numbers) setWabaNumbers(json.numbers)
    } catch (e) {}
    finally { setLoadingWabaNumbers(false) }
  }

  async function handleMigrateNumber() {
    if (!migrateNumber || !migrateTenant) {
      setMigrateMsg('❌ Selecione o número e o cliente de destino')
      return
    }
    setMigrating(true)
    setMigrateMsg('')
    try {
      const h = await authHeader()
      const res = await fetch('/api/whatsapp/migrate-number', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: migrateNumber,
          target_tenant_id: migrateTenant,
        })
      })
      const json = await res.json()
      if (json.ok) {
        setMigrateMsg('✅ ' + json.message)
        setMigrateNumber('')
        setMigrateTenant('')
        loadAll()
      } else {
        setMigrateMsg('❌ ' + (json.error || 'Erro ao migrar'))
      }
    } catch (e) {
      setMigrateMsg('❌ ' + e.message)
    }
    setMigrating(false)
    setTimeout(() => setMigrateMsg(''), 6000)
  }

  async function loadReceipts(cat) {
    setLoadingReceipts(true)
    try {
      const h = await authHeader()
      const category = cat || receiptCategory
      const url = category && category !== 'all' ? '/api/payments/receipts?category=' + category : '/api/payments/receipts'
      const res = await fetch(url, { headers: h })
      const json = await res.json()
      if (json.receipts) setReceipts(json.receipts)
    } catch (e) {}
    finally { setLoadingReceipts(false) }
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

  useEffect(() => {
    if (tab === 'bots' && !wabaNumbers.length) loadWabaNumbers()
  }, [tab])

  if (loading || !user || !tenant || !profile?.is_platform_admin) return null

  const tabs = [
    { key: 'dashboard', icon: '\uD83D\uDCCA', label: 'Dashboard' },
    { key: 'clients',   icon: '\uD83C\uDFE2', label: 'Clientes' },
    { key: 'bots',      icon: '\uD83E\uDD16', label: 'Bots' },
    { key: 'contacts', icon: '\uD83D\uDC64', label: 'Contatos' },
    { key: 'planos',    icon: '\uD83D\uDCC4', label: 'Planos' },
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
          <h1 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 22 }}>Painel Assistente Ark</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Controle total da plataforma — clientes, bots, atividade e servidor.</p>
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
              color: tab === t.key ? '#4f8ef7' : 'var(--text-muted)',
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
            <p style={{ color: 'var(--text-muted)' }}>Carregando estatisticas...</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                <StatTile label="Clientes" value={stats?.totalClients || 0} icon="\uD83C\uDFE2" sub={(stats?.activeBots || 0) + ' ativos'} />
                <StatTile label="Bots Ativos" value={stats?.activeBots || 0} icon="\uD83E\uDD16" sub={(stats?.inactiveBots || 0) + ' inativos'} />
                <StatTile label="Mensagens Hoje" value={stats?.todayLogs || 0} icon="\uD83D\uDCAC" sub={(stats?.totalLogs || 0) + ' total'} />
                <StatTile label="Erros" value={stats?.errorLogs || 0} icon="\u26A0\uFE0F" sub={stats?.errorLogs > 0 ? 'verificar!' : 'tudo ok'} danger={stats?.errorLogs > 0} />
              </div>

              <div className="ark-card">
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Atividade Recente</h3>
                {recentActivity.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma atividade registrada.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentActivity.map((log, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <span style={{ fontSize: 16 }}>{log.error ? '\uD83D\uDD34' : log.event_type === 'message_received' ? '\uD83D\uDCE8' : log.event_type === 'message_sent' ? '\uD83D\uDCE4' : '\u2699\uFE0F'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{log.event_type || 'evento'} {log.contact_phone ? ' - ' + log.contact_phone : ''}</div>
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
            <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
          ) : clients.length === 0 ? (
            <div className="ark-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nenhuma empresa cadastrada ainda.</p>
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
            <p style={{ color: 'var(--text-muted)' }}>Carregando bots...</p>
          ) : allBots.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhum bot encontrado.</p>
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
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{bot.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                        {bot.tenant_name} {bot.phone_number_id ? ' - conectado' : ' - sem numero'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>{bot.total_messages || 0}</div>
                      <div style={{ color: '#334155', fontSize: 10 }}>mensagens</div>
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: bot.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)',
                      color: bot.status === 'active' ? '#22c55e' : 'var(--text-muted)'
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

        {/* Migração de Números */}
        <div className="ark-card" style={{ marginTop: 20, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>🔄</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Migrar Número WhatsApp</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                Associe um número da WABA compartilhada a um cliente específico
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Número</label>
              <select
                value={migrateNumber}
                onChange={e => setMigrateNumber(e.target.value)}
                className="ark-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: 13 }}
              >
                <option value="">Selecione um número...</option>
                {loadingWabaNumbers && <option disabled>Carregando...</option>}
                {wabaNumbers.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.display_phone_number} ({n.verified_name}) {n.code_verification_status === 'VERIFIED' ? '✓' : '⚠'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Cliente destino</label>
              <select
                value={migrateTenant}
                onChange={e => setMigrateTenant(e.target.value)}
                className="ark-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: 13 }}
              >
                <option value="">Selecione um cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleMigrateNumber}
              disabled={migrating || !migrateNumber || !migrateTenant}
              className="ark-btn"
              style={{ fontSize: 13, padding: '10px 20px', whiteSpace: 'nowrap' }}
            >
              {migrating ? '⏳ Migrando...' : '🔄 Migrar'}
            </button>
          </div>

          {migrateMsg && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: migrateMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: migrateMsg.startsWith('✅') ? '#22c55e' : '#ef4444'
            }}>
              {migrateMsg}
            </div>
          )}

          {wabaNumbers.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {wabaNumbers.map(n => (
                <div key={n.id} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 12,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <span>{n.status === 'active' ? '🟢' : '⚪'}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{n.display_phone_number}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{n.verified_name}</span>
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
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              Isso vai remover <strong style={{ color: 'var(--text-primary)' }}>{deregisterTarget.name}</strong> completamente:
            </p>
            <ul style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px', paddingLeft: 20 }}>
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
                  color: 'var(--text-primary)', padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
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
                  color: 'var(--text-primary)', padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 220,
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{contacts.length} contatos</span>
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

          {/* Upload de arquivos */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderRadius: 10, border: '1px dashed rgba(79,142,247,0.3)',
                background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 20 }}>📂</span>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                    {uploadingContacts ? 'Enviando...' : 'Importar contatos (.vcf, .csv)'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    Selecione um ou mais arquivos de contatos do dispositivo
                  </div>
                </div>
                <input
                  type="file"
                  accept=".vcf,.csv,text/vcard,text/csv"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files?.length) uploadContactsFile(Array.from(e.target.files), selectedTenantContacts)
                    e.target.value = ''
                  }}
                  disabled={uploadingContacts || !selectedTenantContacts}
                />
              </label>
            </div>
            {uploadResult && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12 }}>
                <div style={{ color: '#22c55e', fontWeight: 700 }}>✅ {uploadResult.imported} importados</div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  {uploadResult.skipped} duplicados · {uploadResult.total} processados
                </div>
              </div>
            )}
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
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>Nenhum contato sincronizado ainda</p>
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
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.full_name || 'Sem nome'}
                      </div>
                      {c.email && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✉️ {c.email}</div>}
                      {c.phone && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 1 }}>📱 {c.phone}</div>}
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
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Atividade do Servidor</h3>
          {loadingStats ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
          ) : recentActivity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma atividade registrada ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActivity.map((log, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8,
                  background: log.error ? 'rgba(239,68,68,0.05)' : 'var(--bg-secondary)',
                  border: '1px solid ' + (log.error ? 'rgba(239,68,68,0.1)' : 'var(--border-soft)')
                }}>
                  <span style={{ fontSize: 14 }}>{log.error ? '\uD83D\uDD34' : '\uD83D\uDFE2'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>{log.event_type || 'evento'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
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
                  border: '1px solid ' + (logFilter === s ? '#4f8ef7' : 'var(--border-soft)'),
                  background: logFilter === s ? 'rgba(79,142,247,0.15)' : 'transparent',
                  color: logFilter === s ? '#4f8ef7' : 'var(--text-muted)'
                }}>
                {s === 'all' ? 'Todos' : s === 'error' ? 'Erros' : s.replace(/_/g, ' ')}
                {s !== 'all' && ' (' + (s === 'error' ? logs.filter(l => l.error || l.status === 'error') : logs.filter(l => l.event_type === s)).length + ')'}
              </button>
            ))}
            <HelpTip text="Logs do webhook mostram cada evento recebido da Meta (mensagens, status de entrega, erros). Util para diagnosticar problemas." />
          </div>

          {loadingLogs ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhum log encontrado.</p>
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
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 10 }}>{log.contact_phone || ''}</span>
                    </div>
                    <span style={{ color: '#334155', fontSize: 11 }}>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {log.error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8, fontFamily: 'monospace' }}>{log.error}</div>}
                  {log.response && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>{'-> '}{log.response}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── ABA PAGAMENTOS ── */}
      {tab === 'planos' && (
        <div>
          {/* ── Catálogo de Recursos ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>🧩 Catálogo de Recursos</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Defina o preço de cada recurso. Ao montar um plano, os valores se somam automaticamente.</p>
              </div>
              <button onClick={() => { setResourceForm({ name: '', price: '', description: '', category: 'geral' }); setResourceModal('new') }}
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ➕ Novo Recurso
              </button>
            </div>

            {resources.length === 0 ? (
              <div className="ark-card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🧩</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum recurso cadastrado. Crie recursos com preços individuais para montar planos.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {resources.map((r, i) => (
                  <div key={i} className="ark-card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, flex: 1 }}>{r.name}</div>
                      <div style={{ color: '#4f8ef7', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap' }}>R$ {r.price.toFixed(2).replace('.', ',')}</div>
                    </div>
                    {r.description && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>{r.description}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
                      <button onClick={() => { setResourceForm({ name: r.name, price: String(r.price), description: r.description || '', category: r.category || 'geral' }); setResourceModal(r) }}
                        style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ Editar</button>
                      <button onClick={() => deleteResource(r.id)}
                        style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🗑️ Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Separador ── */}
          <div style={{ borderTop: '1px solid var(--border-soft)', margin: '20px 0' }} />

          {/* ── Planos ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>📋 Planos da Plataforma</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Monte planos selecionando recursos. O valor total é a soma dos itens.</p>
            </div>
            <button onClick={() => { setPlanForm({ name: '', price: '', billing_cycle: 'monthly', duration_days: '', description: '', features: '', resource_ids: [] }); setPlanModal('new') }}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ➕ Novo Plano
            </button>
          </div>

          {plans.length === 0 && (
            <div className="ark-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nenhum plano criado ainda.</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>Clique em "Novo Plano" para começar.</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {plans.map((p, i) => (
              <div key={i} className="ark-card" style={{ padding: 20, position: 'relative', opacity: p.active === false ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ color: '#4f8ef7', fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                      R$ {typeof p.price === 'number' ? p.price.toFixed(2).replace('.', ',') : p.price}
                    </div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: p.active === false ? 'var(--bg-secondary)' : 'rgba(34,197,94,0.1)',
                    color: p.active === false ? 'var(--text-dim)' : '#22c55e'
                  }}>
                    {p.active === false ? 'INATIVO' : 'ATIVO'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>
                    {p.billing_cycle === 'monthly' ? '🔄 Mensal' :
                     p.billing_cycle === 'quarterly' ? '🔄 Trimestral' :
                     p.billing_cycle === 'yearly' ? '🔄 Anual' :
                     p.billing_cycle === 'lifetime' ? '♾️ Vitalício' :
                     p.billing_cycle === 'custom' ? `⏱️ ${p.duration_days || 0} dias` : p.billing_cycle}
                  </span>
                </div>

                {p.description && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>{p.description}</p>
                )}

                {p.resource_ids && p.resource_ids.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 600, marginBottom: 6 }}>RECURSOS INCLUSOS:</div>
                    {p.resource_ids.map((rid, j) => {
                      const r = resources.find(x => x.id === rid)
                      return r ? (
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--border-soft)' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>R$ {r.price.toFixed(2).replace('.', ',')}</span>
                        </div>
                      ) : null
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 4, borderTop: '1px solid var(--border-soft)' }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>Total</span>
                      <span style={{ color: '#4f8ef7', fontSize: 13, fontWeight: 800 }}>R$ {(p.resource_ids.reduce((acc, rid) => acc + (resources.find(x => x.id === rid)?.price || 0), 0)).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                )}
                {p.features && p.features.length > 0 && (
                  <ul style={{ margin: '0 0 12px 0', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
                    {p.features.map((f, j) => <li key={j} style={{ marginBottom: 2 }}>{f}</li>)}
                  </ul>
                )}

                <div style={{ display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
                  <button onClick={() => togglePlanActive(p)}
                    style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {p.active === false ? '▶️ Ativar' : '⏸️ Pausar'}
                  </button>
                  <button onClick={() => { setPlanForm({ name: p.name, price: String(p.price), billing_cycle: p.billing_cycle, duration_days: p.duration_days ? String(p.duration_days) : '', description: p.description || '', features: (p.features || []).join('\n') }); setPlanModal(p) }}
                    style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => deletePlan(p.id)}
                    style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Modal de criar/editar plano */}
          {planModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div className="ark-card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                  {planModal === 'new' ? '📋 Novo Plano' : '✏️ Editar Plano'}
                </h3>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do Plano *</label>
                  <input type="text" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="Ex: Plano Starter, Plano Pro..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Ciclo de Cobrança</label>
                  <select value={planForm.billing_cycle} onChange={e => setPlanForm({ ...planForm, billing_cycle: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                    <option value="lifetime">Vitalício</option>
                    <option value="custom">Personalizado (dias)</option>
                  </select>
                </div>

                {planForm.billing_cycle === 'custom' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Duração (em dias)</label>
                    <input type="number" value={planForm.duration_days} onChange={e => setPlanForm({ ...planForm, duration_days: e.target.value })}
                      placeholder="30, 90, 180..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição</label>
                  <textarea value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                    placeholder="Descrição do plano..."
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical' }} />
                </div>

                {resources.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 8 }}>🧩 Recursos do Plano (soma automática)</label>
                    <div style={{ maxHeight: 200, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border-soft)', padding: 8 }}>
                      {resources.map((r, ri) => {
                        const checked = (planForm.resource_ids || []).includes(r.id)
                        return (
                          <div key={ri} onClick={() => toggleResourceInPlan(r.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                              background: checked ? 'rgba(79,142,247,0.08)' : 'transparent',
                              border: '1px solid ' + (checked ? 'rgba(79,142,247,0.2)' : 'transparent'),
                              transition: 'all 0.15s'
                            }}>
                            <span style={{ fontSize: 14 }}>{checked ? '✅' : '⬜'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                              {r.description && <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{r.description}</div>}
                            </div>
                            <div style={{ color: '#4f8ef7', fontSize: 13, fontWeight: 700 }}>R$ {r.price.toFixed(2).replace('.', ',')}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>Soma dos recursos:</span>
                      <span style={{ color: '#4f8ef7', fontSize: 14, fontWeight: 800 }}>
                        R$ {((planForm.resource_ids || []).reduce((acc, rid) => acc + (resources.find(x => x.id === rid)?.price || 0), 0)).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 4 }}>O valor do plano é preenchido automaticamente. Você pode ajustar manualmente abaixo.</div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Valor do Plano (R$) {resources.length > 0 ? '— editável' : '*'}</label>
                  <input type="number" step="0.01" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })}
                    placeholder="99.90"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Recursos extras (um por linha, opcional)</label>
                  <textarea value={planForm.features} onChange={e => setPlanForm({ ...planForm, features: e.target.value })}
                    placeholder={"Ex:\n1 bot ativo\n1000 mensagens/mês\nSuporte por email"}
                    rows={4}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setPlanModal(null)}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => savePlan(planModal !== 'new')} disabled={planSaving || !planForm.name}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (planSaving || !planForm.name) ? 0.5 : 1 }}>
                    {planSaving ? 'Salvando...' : (planModal === 'new' ? 'Criar Plano' : 'Salvar')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de criar/editar recurso */}
          {resourceModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div className="ark-card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                  {resourceModal === 'new' ? '🧩 Novo Recurso' : '✏️ Editar Recurso'}
                </h3>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do Recurso *</label>
                  <input type="text" value={resourceForm.name} onChange={e => setResourceForm({ ...resourceForm, name: e.target.value })}
                    placeholder="Ex: 1 Bot ativo, 5000 mensagens/mês..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Preço (R$) *</label>
                  <input type="number" step="0.01" value={resourceForm.price} onChange={e => setResourceForm({ ...resourceForm, price: e.target.value })}
                    placeholder="49.90"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição (opcional)</label>
                  <input type="text" value={resourceForm.description} onChange={e => setResourceForm({ ...resourceForm, description: e.target.value })}
                    placeholder="Breve descrição do recurso"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Categoria</label>
                  <select value={resourceForm.category} onChange={e => setResourceForm({ ...resourceForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                    <option value="geral">Geral</option>
                    <option value="bot">Bot</option>
                    <option value="mensagens">Mensagens</option>
                    <option value="suporte">Suporte</option>
                    <option value="storage">Armazenamento</option>
                    <option value="integracao">Integração</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setResourceModal(null)}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => saveResource(resourceModal !== 'new')} disabled={resourceSaving || !resourceForm.name}
                    style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (resourceSaving || !resourceForm.name) ? 0.5 : 1 }}>
                    {resourceSaving ? 'Salvando...' : (resourceModal === 'new' ? 'Criar' : 'Salvar')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div>
          <div className="ark-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>💰 Configuração de Pagamentos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>Chave PIX</label>
                <input value={payConfig.pix_key} onChange={e => setPayConfig(c => ({ ...c, pix_key: e.target.value }))} placeholder="ex: arkieltech@gmail.com"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>Nome do Recebedor</label>
                <input value={payConfig.merchant_name} onChange={e => setPayConfig(c => ({ ...c, merchant_name: e.target.value }))} placeholder="ex: Arkiel Tech"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>Cidade</label>
                <input value={payConfig.merchant_city} onChange={e => setPayConfig(c => ({ ...c, merchant_city: e.target.value }))} placeholder="ex: SAO PAULO"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>Token Mercado Pago (opcional)</label>
                <input value={payConfig.mp_access_token} onChange={e => setPayConfig(c => ({ ...c, mp_access_token: e.target.value }))} placeholder="APP_USR-..." type="password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginTop: 4 }} />
              </div>
            </div>
            <button onClick={savePayConfig} disabled={savingPayConfig}
              style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: savingPayConfig ? 0.5 : 1 }}>
              {savingPayConfig ? 'Salvando...' : '💾 Salvar Configuração'}
            </button>
          </div>

          {/* ── Taxas por método de pagamento ── */}
          <div className="ark-card" style={{ padding: 20, marginBottom: 20, border: '1px solid rgba(79,142,247,0.15)' }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>📊 Taxas da Plataforma (Marketplace Fee)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
              Define a porcentagem que a Arkiel retém de cada transação B2B, por método de pagamento. O valor vai direto para a conta MP do cliente, e o MP retém a taxa automaticamente.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { key: 'pix', label: 'PIX', icon: '💠', color: '#22c55e' },
                { key: 'credit_card', label: 'Cartão de Crédito', icon: '💳', color: '#4f8ef7' },
                { key: 'debit_card', label: 'Cartão de Débito', icon: '💳', color: '#8b5cf6' },
                { key: 'boleto', label: 'Boleto', icon: '🧾', color: '#f59e0b' },
              ].map(method => (
                <div key={method.key} style={{ padding: '14px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 18 }}>{method.icon}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>{method.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={feeConfig[method.key] ?? 2.0}
                      onChange={e => setFeeConfig(f => ({ ...f, [method.key]: parseFloat(e.target.value) || 0 }))}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 8,
                        border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, outline: 'none',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ color: method.color, fontSize: 16, fontWeight: 700 }}>%</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 6, textAlign: 'center' }}>
                    R$ {((feeConfig[method.key] ?? 2.0) / 100 * 100).toFixed(2)} por cada R$100
                  </div>
                </div>
              ))}
            </div>
            {feeMsg && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: feeMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: feeMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
                {feeMsg}
              </div>
            )}
            <button onClick={saveFeeConfig} disabled={savingFees}
              style={{ marginTop: 14, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: savingFees ? 0.5 : 1 }}>
              {savingFees ? 'Salvando...' : '💾 Salvar Taxas'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <StatTile label="Total Recebido" value={'R$ ' + (payments.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(p.amount), 0)).toFixed(2)} icon="✅" />
            <StatTile label="Pendentes" value={'R$ ' + (payments.filter(p => p.status === 'pending').reduce((s, p) => s + parseFloat(p.amount), 0)).toFixed(2)} icon="⏳" />
            <StatTile label="Pagamentos" value={payments.length} icon="📊" />
          </div>

          <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Histórico de Pagamentos</h3>
          {loadingPayments ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
          ) : payments.length === 0 ? (
            <div className="ark-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
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
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>R$ {parseFloat(p.amount).toFixed(2)}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: p.status === 'paid' ? 'rgba(34,197,94,0.15)' : p.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                        color: p.status === 'paid' ? '#22c55e' : p.status === 'pending' ? '#f59e0b' : '#ef4444'
                      }}>
                        {p.status === 'paid' ? '✅ Pago' : p.status === 'pending' ? '⏳ Pendente' : '❌ ' + p.status}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                      {p.description || 'Pagamento'} • {new Date(p.created_at).toLocaleString('pt-BR')}
                      {p.paid_at && ' • Pago em ' + new Date(p.paid_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {p.pix_code && (
                    <button onClick={() => navigator.clipboard.writeText(p.pix_code)} title="Copiar código PIX"
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 11, cursor: 'pointer' }}>
                      📋 Copiar PIX
                    </button>
                  )}
                  {p.mp_checkout_url && (
                    <a href={p.mp_checkout_url} target="_blank" rel="noopener"
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 11, textDecoration: 'none' }}>
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
          {/* Sub-tabs de categoria */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
            {[
              { key: 'all', label: 'Todos', icon: '📋', color: '#4f8ef7' },
              { key: 'b2c_client', label: 'Cliente → Empresa', icon: '👤', color: '#22c55e', desc: 'PIX/Link enviado ao cliente' },
              { key: 'b2c_catalog', label: 'Catálogo WhatsApp', icon: '🛒', color: '#f59e0b', desc: 'Compra pelo catálogo B2C' },
              { key: 'b2b_manual', label: 'Manual (Empresa)', icon: '🏢', color: '#a78bfa', desc: 'Maquininha/externo' },
            ].map(cat => (
              <button key={cat.key} onClick={() => { setReceiptCategory(cat.key); loadReceipts(cat.key) }}
                style={{
                  padding: '8px 14px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  border: 'none', borderBottom: receiptCategory === cat.key ? `2px solid ${cat.color}` : '2px solid transparent',
                  background: receiptCategory === cat.key ? `${cat.color}15` : 'transparent',
                  color: receiptCategory === cat.key ? cat.color : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                }}>
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
              📄 Comprovantes{receiptCategory !== 'all' ? ` — ${receipts.length} registro(s)` : ''}
            </h3>
            <button onClick={() => { setReceiptModal(true); loadPayments() }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#a78bfa', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              🏢 + Comprovante Manual
            </button>
          </div>

          {/* Stats por categoria */}
          {receiptCategory === 'all' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { cat: 'b2c_client', label: '👤 Cliente → Empresa', icon: '💚', desc: 'PIX/Link' },
                { cat: 'b2c_catalog', label: '🛒 Catálogo WhatsApp', icon: '🛍️', desc: 'Compra B2C' },
                { cat: 'b2b_manual', label: '🏢 Manual (Empresa)', icon: '📋', desc: 'Maquininha/Externo' },
              ].map(s => {
                const count = receipts.filter(r => (r.category || 'b2c_client') === s.cat).length
                const total = receipts.filter(r => (r.category || 'b2c_client') === s.cat)
                  .reduce((sum, r) => sum + (parseFloat(r.payments?.amount) || 0), 0)
                return (
                  <div key={s.cat} className="ark-card" style={{ padding: 14, cursor: 'pointer' }}
                       onClick={() => { setReceiptCategory(s.cat); loadReceipts(s.cat) }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, marginTop: 4 }}>{count}</div>
                    <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>R$ {total.toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {loadingReceipts ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
          ) : receipts.length === 0 ? (
            <div className="ark-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              Nenhum comprovante nesta categoria.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {receipts.map(r => {
                const cat = r.category || 'b2c_client'
                const catInfo = {
                  b2c_client: { label: '👤 Cliente', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
                  b2c_catalog: { label: '🛒 Catálogo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                  b2b_manual: { label: '🏢 Manual', color: '#a78bfa', bg: 'rgba(167,139,246,0.12)' },
                }[cat] || { label: '📄', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.12)' }

                return (
                  <div key={r.id} className="ark-card" style={{ padding: 14, borderLeft: `3px solid ${catInfo.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 18 }}>
                          {r.file_type === 'pdf' ? '📄' : r.file_type === 'catalog_order' ? '🛒' : r.file_type === 'mp_confirmation' ? '💳' : '🖼️'}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: catInfo.bg, color: catInfo.color }}>
                          {catInfo.label}
                        </span>
                        {r.payments && r.payments.status === 'paid' && (
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✅ Pago</span>
                        )}
                        {r.metadata?.avulso && (
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>Avulso</span>
                        )}
                      </div>
                      <button onClick={() => deleteReceipt(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
                    </div>

                    {r.payments && parseFloat(r.payments.amount) > 0 && (
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                        R$ {parseFloat(r.payments.amount).toFixed(2)} — {r.payments.description || 'Pagamento'}
                      </div>
                    )}
                    {(!r.payments || parseFloat(r.payments.amount) === 0) && (
                      <div style={{ color: cat === 'b2b_manual' ? '#a78bfa' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {r.notes || 'Sem valor informado'}
                      </div>
                    )}

                    {r.file_type === 'pdf' && r.file_url && (
                      <a href={r.file_url} target="_blank" rel="noopener" style={{ color: '#4f8ef7', fontSize: 12, textDecoration: 'none' }}>📎 Ver comprovante (PDF)</a>
                    )}
                    {r.file_type === 'image' && r.file_url && !r.file_url.startsWith('__media__') && (
                      <a href={r.file_url} target="_blank" rel="noopener">
                        <img src={r.file_url} alt="Comprovante" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', cursor: 'pointer', marginTop: 4 }} />
                      </a>
                    )}
                    {r.file_type === 'catalog_order' && r.metadata?.items && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                        {r.metadata.items.length} item(ns) — R$ {parseFloat(r.metadata.total || 0).toFixed(2)}
                      </div>
                    )}
                    {r.file_type === 'mp_confirmation' && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Confirmado automaticamente via Mercado Pago</div>
                    )}

                    {/* Editar valor de avulso */}
                    {(cat === 'b2b_manual' || r.metadata?.avulso) && (!r.payments || parseFloat(r.payments.amount) === 0) && editingReceipt !== r.id && (
                      <button onClick={() => setEditingReceipt(r.id)}
                        style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(167,139,246,0.3)', background: 'transparent', color: '#a78bfa', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        ✏️ Definir valor
                      </button>
                    )}
                    {editingReceipt === r.id && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <input type="number" step="0.01" placeholder="Valor R$" defaultValue=""
                          id={`edit-val-${r.id}`}
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} />
                        <button onClick={() => { const v = document.getElementById(`edit-val-${r.id}`).value; if (v) updateReceipt(r.id, v, r.notes) }}
                          style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setEditingReceipt(null)}
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </div>
                    )}

                    <div style={{ color: '#334155', fontSize: 10, marginTop: 6 }}>
                      {r.uploaded_by} • {new Date(r.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal de upload de comprovante manual (B2B) */}
          {receiptModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                 onClick={() => setReceiptModal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d1e', borderRadius: 16, padding: 24, maxWidth: 440, width: '90%', border: '1px solid rgba(167,139,246,0.25)' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🏢 Comprovante Manual</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>Para pagamentos recebidos fora do WhatsApp (maquininha, dinheiro, transferência externa)</p>

                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Valor (R$) *</label>
                <input type="number" step="0.01" min="0.01" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)} placeholder="Ex: 50.00"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 12 }} />

                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição</label>
                <input value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} placeholder="Ex: Maquininha — Venda presencial"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 16 }} />

                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Comprovante (imagem ou PDF)</label>
                <input type="file" accept="image/*,application/pdf" id="receipt-file" style={{ width: '100%', color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }} />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setReceiptModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => { const f = document.getElementById('receipt-file').files[0]; if (f) uploadReceipt(f); else alert('Selecione um arquivo'); if (!receiptAmount) { alert('Informe o valor'); return } }}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#a78bfa', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Registrar</button>
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
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ color: danger ? '#ef4444' : 'var(--text-primary)', fontWeight: 800, fontSize: 28 }}>{value}</div>
      <div style={{ color: danger ? '#ef4444' : '#334155', fontSize: 11, marginTop: 4 }}>{sub}</div>
    </div>
  )
}
