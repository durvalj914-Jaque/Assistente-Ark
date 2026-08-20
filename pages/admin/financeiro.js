import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, getEffectiveLimits, isPlanActive, getActivePlanLabel } from '../../lib/plans'

export default function FinanceiroPage() {
  const { user, tenant, role, profile, loading } = useTenant()
  const router = useRouter()
  const [subTab, setSubTab] = useState(router.query.tab || 'payment_methods')

  // Formas de pagamento
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loadingPM, setLoadingPM] = useState(false)
  const [pmModal, setPmModal] = useState(null) // { type: 'payment'|'billing', editing: null }
  const [pmForm, setPmForm] = useState({ method_name: '', method_key: '', is_active: true })

  // Pagamentos / histórico
  const [payConfig, setPayConfig] = useState({ pix_key: '', merchant_name: '', merchant_city: '', mp_access_token: '' })
  const [savingPayConfig, setSavingPayConfig] = useState(false)
  const [feeConfig, setFeeConfig] = useState({ pix: 2.0, credit_card: 3.0, debit_card: 2.5, boleto: 2.0 })
  const [mpConnected, setMpConnected] = useState(false)
  const [mpExpanded, setMpExpanded] = useState(false)
  const [mpDisconnecting, setMpDisconnecting] = useState(false)
  const [mpDisconnectResult, setMpDisconnectResult] = useState(null)
  const [mpConnecting, setMpConnecting] = useState(false)
  const [mpUser, setMpUser] = useState('')
  const [mpMethods, setMpMethods] = useState({ pix: true, credit_card: true, debit_card: true, boleto: true })
  const [mpAvailableMethods, setMpAvailableMethods] = useState([])
  const [loadingMpMethods, setLoadingMpMethods] = useState(false)
  const [mpAccount, setMpAccount] = useState(null)
  const [payments, setPayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  // Comprovantes
  const [receipts, setReceipts] = useState([])
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [receiptCategory, setReceiptCategory] = useState('all')
  const [editingReceipt, setEditingReceipt] = useState(null)
  const [receiptModal, setReceiptModal] = useState(false)
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptAmount, setReceiptAmount] = useState('')
  const [availablePayments, setAvailablePayments] = useState([])

  // Pagamentos pendentes (enviados via chat, aguardando B2C)
  const [pendingPayments, setPendingPayments] = useState([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [cancelingId, setCancelingId] = useState(null)

  // Billing Arkiel (planos, bots, mensagens)
  const [billingStatus, setBillingStatus] = useState(null)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [arkielPayments, setArkielPayments] = useState([])
  const [loadingArkielPayments, setLoadingArkielPayments] = useState(false)

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token || ''}` }
  }, [])

  // Helper: extract numeric fee value from either flat number or nested object format
  function feeVal(method) {
    const v = feeConfig[method]
    if (typeof v === "number") return v
    if (v && typeof v === "object") return v.fee_percent || 0
    return 0
  }
  // ── BILLING ARKIEL (planos) ──
  async function loadBillingStatus() {
    if (!tenant?.id) return
    setLoadingBilling(true)
    try {
      const h = await authHeader()
      const res = await fetch(`/api/billing/status?tenantId=${tenant.id}`, { headers: h })
      const json = await res.json()
      if (!json.error) setBillingStatus(json)
    } catch (e) { console.error('billing status:', e) }
    finally { setLoadingBilling(false) }
  }

  async function loadArkielPayments() {
    setLoadingArkielPayments(true)
    try {
      const h = await authHeader()
      // Busca pagamentos feitos para a Arkiel (subscription payments)
      const res = await fetch('/api/payments/history', { headers: h })
      const json = await res.json()
      if (json.payments) setArkielPayments(json.payments)
    } catch (e) { console.error('arkiel payments:', e) }
    finally { setLoadingArkielPayments(false) }
  }

  // ── PAYMENT METHODS ──
  async function loadPaymentMethods(type) {
    setLoadingPM(true)
    try {
      const h = await authHeader()
      const res = await fetch(`/api/payment-methods?type=${type}`, { headers: h })
      const json = await res.json()
      if (json.methods) setPaymentMethods(json.methods)
    } catch (e) { console.error('pm load', e) }
    finally { setLoadingPM(false) }
  }

  async function savePaymentMethod() {
    try {
      const h = await authHeader()
      const headers = { ...h, 'Content-Type': 'application/json' }
      if (pmModal?.editing) {
        await fetch('/api/payment-methods', { method: 'PATCH', headers, body: JSON.stringify({ id: pmModal.editing, ...pmForm }) })
      } else {
        await fetch('/api/payment-methods', { method: 'POST', headers, body: JSON.stringify({ type: pmModal.type, ...pmForm }) })
      }
      setPmModal(null)
      setPmForm({ method_name: '', method_key: '', is_active: true })
      loadPaymentMethods(pmModal.type)
    } catch (e) { alert('Erro: ' + e.message) }
  }

  async function deletePaymentMethod(id, type) {
    if (!confirm('Remover esta forma?')) return
    try {
      const h = await authHeader()
      await fetch(`/api/payment-methods?id=${id}`, { method: 'DELETE', headers: h })
      loadPaymentMethods(type)
    } catch (e) { alert('Erro: ' + e.message) }
  }

  async function togglePaymentMethod(id, current, type) {
    try {
      const h = await authHeader()
      await fetch('/api/payment-methods', { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: !current }) })
      loadPaymentMethods(type)
    } catch (e) {}
  }

  // ── PAYMENTS HISTORY ──
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

  async function loadPendingPayments() {
    setLoadingPending(true)
    try {
      const h = await authHeader()
      const res = await fetch('/api/payments/list?status=pending', { headers: h })
      const json = await res.json()
      if (json.payments) setPendingPayments(json.payments)
    } catch (e) {}
    finally { setLoadingPending(false) }
  }

  async function cancelPayment(paymentId) {
    if (!confirm('⚠️ Cancelar este pagamento pendente?\n\nO cliente não poderá mais pagar por este link/QR Code.')) return
    setCancelingId(paymentId)
    try {
      const h = await authHeader()
      const res = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: paymentId })
      })
      const json = await res.json()
      if (json.ok) {
        loadPendingPayments()
      } else {
        alert('Erro: ' + (json.error || 'Falha ao cancelar'))
      }
    } catch (e) {
      alert('Erro: ' + e.message)
    }
    finally { setCancelingId(null) }
  }

  async function loadPayConfig() {
    try {
      const h = await authHeader()
      // Buscar config e status do MP em paralelo
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/payments/config', { headers: h }),
        fetch('/api/mercadopago/status', { headers: h })
      ])
      const json = await configRes.json()
      const status = await statusRes.json()
      
      if (json.config) {
        setPayConfig({ pix_key: json.config.pix_key || '', merchant_name: json.config.merchant_name || '', merchant_city: json.config.merchant_city || '', mp_access_token: json.config.mp_access_token || '' })
        if (json.config.fee_config) setFeeConfig(json.config.fee_config)
        // Usar o status endpoint para determinar conexao (mais confiavel)
        setMpConnected(status.mp_connected === true)
        if (status.mp_connected && status.token_info) {
          setMpUser(status.token_info.user_nickname || '')
        }
        if (json.config.mp_access_token) {
          try { 
            const parsed = JSON.parse(json.config.mp_access_token)
            if (parsed.mp_methods) setMpMethods(parsed.mp_methods)
          } catch {}
        }
        // So buscar formas de MP se o tenant tem conta propria conectada
        if (status.mp_connected && json.config.id) fetchMPMethods(json.config.id)
        else { setMpAvailableMethods([]); setMpAccount(null); setMpUser('') }
      }
    } catch (e) {}
  }

  async function fetchMPMethods(tenantId) {
    setLoadingMpMethods(true)
    try {
      const h = await authHeader()
      const res = await fetch(`/api/mercadopago/methods?tenant_id=${tenantId}&platform_fallback=true`, { headers: h })
      const json = await res.json()
      if (json.connected && json.methods) setMpAvailableMethods(json.methods)
      else setMpAvailableMethods([])
      if (json.account) setMpAccount(json.account)
      else setMpAccount(null)
    } catch (e) { console.error('fetchMPMethods:', e); setMpAvailableMethods([]); setMpAccount(null) }
    finally { setLoadingMpMethods(false) }
  }

  async function connectMP() {
    setMpConnecting(true)
    try {
      const h = await authHeader()
      const res = await fetch('/api/mercadopago/oauth/init?return_to=admin', { headers: h })
      const json = await res.json()
      if (json.authUrl) window.location.href = json.authUrl
      else alert('Erro ao iniciar conexão: ' + (json.error || ''))
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setMpConnecting(false) }
  }

  async function disconnectMP() {
    if (!confirm('⚠️ Desconectar o Mercado Pago?\n\nSua conta MP será desvinculada da plataforma Arkiel.\n\n• Os pagamentos deixarão de ter confirmação automática\n• A taxa da Arkiel não será mais aplicada\n• Você voltará a receber apenas via PIX direto (chave própria)\n\nDeseja continuar?')) return
    try {
      const h = await authHeader()
      await fetch('/api/payments/config', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payConfig, mp_access_token: '' }) })
      setMpConnected(false)
      setMpUser('')
    } catch (e) { alert('Erro: ' + e.message) }
  }

  async function toggleMPMethod(method) {
    const newMethods = { ...mpMethods, [method]: !mpMethods[method] }
    setMpMethods(newMethods)
    try {
      const h = await authHeader()
      const parsed = JSON.parse(payConfig.mp_access_token || '{}')
      parsed.mp_methods = newMethods
      const updated = JSON.stringify(parsed)
      setPayConfig(p => ({ ...p, mp_access_token: updated }))
      await fetch('/api/payments/config', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payConfig, mp_access_token: updated }) })
    } catch (e) { console.error('Toggle MP method error:', e) }
  }

  async function savePayConfig() {
    setSavingPayConfig(true)
    try {
      const h = await authHeader()
      await fetch('/api/payments/config', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(payConfig) })
      alert('✅ Configurações salvas!')
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setSavingPayConfig(false) }
  }

  // ── RECEIPTS ──
  async function loadReceipts(cat) {
    setLoadingReceipts(true)
    try {
      const h = await authHeader()
      const category = cat || receiptCategory
      const url = category && category !== 'all' ? `/api/payments/receipts?category=${category}` : '/api/payments/receipts'
      const res = await fetch(url, { headers: h })
      const json = await res.json()
      if (json.receipts) setReceipts(json.receipts)
    } catch (e) {}
    finally { setLoadingReceipts(false) }
  }

  async function updateReceipt(id, amount, notes) {
    try {
      const h = await authHeader()
      const res = await fetch('/api/payments/receipts', { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, amount, notes }) })
      if (res.ok) { setEditingReceipt(null); loadReceipts() }
    } catch (e) { alert('Erro: ' + e.message) }
  }

  async function deleteReceipt(id) {
    if (!confirm('Deletar este comprovante?')) return
    try {
      const h = await authHeader()
      await fetch(`/api/payments/receipts?id=${id}`, { method: 'DELETE', headers: h })
      loadReceipts()
    } catch (e) {}
  }

  async function uploadReceipt(file) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fileName = `receipts/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('payment-receipts').upload(fileName, file)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(fileName)

      const h = await authHeader()
      const res = await fetch('/api/payments/receipts', {
        method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_url: urlData.publicUrl, file_type: file.type?.startsWith('image') ? 'image' : 'pdf', file_name: file.name, notes: receiptNotes, amount: receiptAmount || null })
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      setReceiptModal(false); setReceiptNotes(''); setReceiptAmount('')
      loadReceipts()
      alert('✅ Comprovante registrado!')
    } catch (e) { alert('Erro: ' + e.message) }
  }

  // Sync subTab with URL query
  useEffect(() => {
    // Check MP OAuth result
    const params = new URLSearchParams(window.location.search)
    if (params.get('mp_success')) {
      const mpUser = params.get('mp_user')
      setMpDisconnectResult({ success: true, message: 'Mercado Pago conectado' + (mpUser ? ` — ${mpUser}` : '') })
      setTimeout(() => window.location.reload(), 2000)
    }
    if (params.get('mp_error')) {
      setMpDisconnectResult({ success: false, message: params.get('mp_error') })
    }
    if (router.query.tab) setSubTab(router.query.tab)
  }, [router.query.tab])

  // ── LOAD ON MOUNT ──
  useEffect(() => {
    if (!user) return
    loadPayConfig()
    loadBillingStatus()
    if (subTab === 'payment_methods') { loadPaymentMethods('payment'); loadArkielPayments() }
    else if (subTab === 'receipts') { loadReceipts('all'); loadPayments() }
    else if (subTab === 'history') { loadPayments() }
  }, [user, subTab])



  if (loading || !user) return <AdminLayout tenant={tenant} user={user} role={role} profile={profile}><div style={{ padding: 40, color: '#64748b' }}>Carregando...</div></AdminLayout>

  const SUB_TABS = [
    { key: 'payment_methods', label: 'Formas de Pagamento', icon: '💳', desc: 'Como você paga' },
    { key: 'receipts', label: 'Comprovantes', icon: '📄', desc: 'Seus comprovantes salvos' },
  ]

  const PM_PRESETS = {
    payment: [
      { name: 'Cartão de Crédito', icon: '💳', key_label: 'Bandeira (Visa, Master...)' },
      { name: 'Cartão de Débito', icon: '💳', key_label: 'Bandeira' },
      { name: 'PIX', icon: '💠', key_label: 'Chave PIX usada' },
      { name: 'Boleto Bancário', icon: '🧾', key_label: 'Banco' },
      { name: 'Dinheiro', icon: '💵', key_label: '' },
      { name: 'Transferência Bancária', icon: '🏦', key_label: 'Conta' },
    ],
    billing: [],
  }


  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>💰 Financeiro</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gerencie suas formas de pagamento, cobranças e comprovantes</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {SUB_TABS.map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            style={{
              flex: 1,
              padding: '14px 12px',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: subTab === st.key ? 700 : 500,
              border: subTab === st.key ? '1px solid #4f8ef7' : '1px solid var(--border-soft)',
              background: subTab === st.key ? '#4f8ef7' : 'var(--bg-card, #fff)',
              color: subTab === st.key ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{st.icon}</div>
            <div>{st.label}</div>
            <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>{st.desc}</div>
          </button>
        ))}
      </div>

      {/* ── MERCADO PAGO (apenas na aba Formas de Pagamento) ── */}
      {subTab === 'payment_methods' && (
      <div style={{ marginBottom: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
        {/* Header / Botão expansível */}
        <button
          onClick={() => { if (!mpExpanded && mpConnected && tenant?.id) fetchMPMethods(tenant.id); setMpExpanded(!mpExpanded) }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', cursor: 'pointer', border: 'none',
            background: mpConnected ? 'rgba(34,197,94,0.06)' : 'rgba(0,158,227,0.05)',
            transition: 'all .15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{mpConnected ? '✅' : '🟡'}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                Mercado Pago
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: mpConnected ? 'rgba(34,197,94,0.12)' : 'rgba(0,158,227,0.1)',
                  color: mpConnected ? '#22c55e' : '#009ee3',
                }}>
                  {mpConnected ? 'CONECTADO' : 'PLATAFORMA'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                {mpConnected
                  ? `${mpUser || 'Sua conta'} • Taxa Arkiel: ${feeVal('pix')}% (PIX) / ${feeVal('credit_card')}% (Crédito)`
                  : `Conecte sua conta para receber direto • Taxa: ${feeVal('pix')}%-${feeVal('credit_card')}% por transação`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              {mpExpanded ? 'Recolher' : 'Expandir'}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 8, background: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-soft)', fontSize: 14,
              transform: mpExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s',
            }}>
              ▾
            </span>
          </div>
        </button>

        {/* Conteúdo expansível */}
        {mpExpanded && (
          <div style={{ padding: '20px', background: 'var(--bg-card, #fff)' }}>
            {/* ── Card de conexão ── */}
            <div className="ark-card" style={{ padding: '14px 18px', marginBottom: 16, border: mpConnected ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(0,158,227,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{mpConnected ? '✅' : '🟡'}</span>
                <div>
                  <div style={{ color: mpConnected ? '#22c55e' : 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>
                    {mpConnected ? `Mercado Pago conectado${mpUser ? ` — ${mpUser}` : ''}` : 'Mercado Pago — usando conta da plataforma'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                    {mpConnected
                      ? `Sua conta própria • Taxa Arkiel: ${feeVal('pix')}% (PIX) / ${feeVal('credit_card')}% (Crédito) • Confirmação automática via webhook`
                      : `Conecte sua própria conta para receber direto • Taxa Arkiel: ${feeVal('pix')}%-${feeVal('credit_card')}% por transação`}
                  </div>
                </div>
              </div>
              {mpConnected ? (
                <button onClick={disconnectMP} disabled={mpDisconnecting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 10, cursor: mpDisconnecting ? 'wait' : 'pointer',
                    border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444', fontSize: 13, fontWeight: 700, transition: 'all .15s',
                    whiteSpace: 'nowrap', opacity: mpDisconnecting ? 0.5 : 1,
                  }}>
                  {mpDisconnecting ? 'Desconectando...' : '🗑️ Desconectar MP'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={connectMP} disabled={mpConnecting}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                      border: 'none', background: 'linear-gradient(135deg, #009ee3, #00b1c0)',
                      color: '#fff', fontSize: 13, fontWeight: 700, transition: 'all .15s',
                      whiteSpace: 'nowrap', opacity: mpConnecting ? 0.5 : 1,
                    }}>
                    {mpConnecting ? 'Conectando...' : '🔗 Conectar minha conta'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Formas de Cobrança vinculadas à conta MP ── */}
            {mpConnected && (
              <div className="ark-card" style={{ padding: 16, marginBottom: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📥</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Formas de Cobrança vinculadas</span>
                  </div>
                  {mpAccount && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                      Conta: {mpAccount.nickname || mpAccount.email || '—'}
                    </span>
                  )}
                </div>
                {loadingMpMethods ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Carregando formas...</div>
                ) : mpAvailableMethods.length === 0 ? (
                  <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    Nenhuma forma de cobrança encontrada. Verifique se sua conta MP está ativa.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {mpAvailableMethods.map(cat => (
                      <div key={cat.key} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>{cat.icon}</span>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 12 }}>{cat.label}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{cat.desc}</div>
                          </div>
                          <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 10, fontWeight: 700 }}>
                            {cat.methods.length} disponíve{cat.methods.length === 1 ? 'l' : 'is'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {cat.methods.map(m => (
                            <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-soft)', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Resumo de taxas (Arkiel + Provedor) ── */}
            <div className="ark-card" style={{ padding: 16, marginBottom: 16, border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>📊</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Resumo de Taxas por Método</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {/* PIX */}
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>💠</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>PIX</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa Arkiel:</span><span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeVal('pix')}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa MP:</span><span style={{ color: '#22c55e', fontWeight: 700 }}>Grátis</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
                    <span>Você recebe (R$100):</span><span>R$ {(100 - 100 * feeVal('pix') / 100 - 0).toFixed(2)}</span>
                  </div>
                </div>
                {/* Crédito */}
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>💳</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>Crédito</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa Arkiel:</span><span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeVal('credit_card')}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa MP:</span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>~4,99%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
                    <span>Você recebe (R$100):</span><span>R$ {(100 - 100 * feeVal('credit_card') / 100 - 4.99).toFixed(2)}</span>
                  </div>
                </div>
                {/* Débito */}
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>💳</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>Débito</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa Arkiel:</span><span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeVal('debit_card')}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa MP:</span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>~2,39%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
                    <span>Você recebe (R$100):</span><span>R$ {(100 - 100 * feeVal('debit_card') / 100 - 2.39).toFixed(2)}</span>
                  </div>
                </div>
                {/* Boleto */}
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>🧾</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>Boleto</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa Arkiel:</span><span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeVal('boleto')}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Taxa MP:</span><span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ 3,99</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-soft)' }}>
                    <span>Você recebe (R$100):</span><span>R$ {(100 - 100 * feeVal('boleto') / 100 - 3.99).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Point Tap: Smartphone como maquininha ── */}
            <div className="ark-card" style={{ padding: 24, marginBottom: 16, border: '1px solid rgba(34,197,94,0.2)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 140, height: 140, background: 'linear-gradient(135deg, rgba(34,197,94,0.06), rgba(79,142,247,0.04))', borderRadius: '0 0 0 100%' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>📱</span>
                  <div>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Point Tap — Celular como Maquininha</h3>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Receba pagamentos por aproximação (NFC) sem hardware extra</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {/* Android */}
                  <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>🤖</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Android (Point Tap)</span>
                    </div>
                    <ol style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                      <li>Abra o app <strong style={{ color: 'var(--text-secondary)' }}>Mercado Pago</strong></li>
                      <li>Na tela inicial, toque em <strong style={{ color: '#22c55e' }}>Cobrar com Point Tap</strong></li>
                      <li>Digite o valor da venda</li>
                      <li>Peça para o cliente aproximar o cartão ou celular no NFC do aparelho</li>
                      <li>Pronto! O dinheiro cai na sua conta MP na hora</li>
                    </ol>
                    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.08)', fontSize: 11, color: '#22c55e', fontWeight: 600 }}>
                      ✓ Requisitos: Android com NFC + app Mercado Pago + internet
                    </div>
                  </div>

                  {/* iPhone */}
                  <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>🍎</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>iPhone (Tap to Pay)</span>
                    </div>
                    <ol style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                      <li>Abra o app <strong style={{ color: 'var(--text-secondary)' }}>Mercado Pago</strong></li>
                      <li>Toque em <strong style={{ color: '#4f8ef7' }}>Cobrar</strong> e selecione <strong style={{ color: '#4f8ef7' }}>Tap to Pay no iPhone</strong></li>
                      <li>Digite o valor e confirme</li>
                      <li>Aproxime o cartão ou iPhone/Apple Watch do cliente na parte superior do aparelho</li>
                      <li>Pagamento aprovado na hora</li>
                    </ol>
                    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(79,142,247,0.08)', fontSize: 11, color: '#4f8ef7', fontWeight: 600 }}>
                      ✓ Requisitos: iPhone XS ou superior + iOS 15.4+ + app Mercado Pago
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>💡</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Como funciona com a taxa da Arkiel</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    As transações do Point Tap entram no mesmo ecossistema do Mercado Pago. A taxa da Arkiel de <strong style={{ color: 'var(--text-secondary)' }}>{feeVal('pix')}%</strong> (PIX) / <strong style={{ color: 'var(--text-secondary)' }}>{feeVal('credit_card')}%</strong> (Crédito) é retida automaticamente, igual às transações online. Você não precisa configurar nada extra — basta ter a conta PJ ativa no Mercado Pago.
                  </p>
                </div>

                {/* Taxas do provedor (Mercado Pago) */}
                <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: 'rgba(255,196,0,0.05)', border: '1px solid rgba(255,196,0,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>🟡</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>Taxas do Mercado Pago (Provedor)</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, margin: '0 0 10px 0' }}>
                    Além da taxa da Arkiel, o Mercado Pago cobra sua própria taxa por processamento. Os valores abaixo são os praticados oficialmente pelo MP para contas PJ no Brasil:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>💠</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>PIX</span>
                      </div>
                      <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>Grátis</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>💳</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Crédito</span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>~4,99% a.vista</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>💳</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Débito</span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>~2,39%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>🧾</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Boleto</span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>R$ 3,99 fixo</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,196,0,0.06)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Exemplo:</strong> Uma venda de R$ 100 no crédito: o MP cobra ~R$ 4,99 (taxa dele) + a Arkiel cobra <strong style={{ color: 'var(--text-secondary)' }}>R$ {feeVal('credit_card')}</strong> (taxa da plataforma). O cliente B2B recebe líquido ~R$ {(100 - 4.99 - feeVal('credit_card')).toFixed(2)}.
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    * Taxas do MP podem variar conforme plano da conta (Standard/Pro/Premium) e promoções. Confirme sempre no app do Mercado Pago.
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="https://www.mercadopago.com.br/ferramentas-para-vender/point-tap/ios" target="_blank" rel="noopener"
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontSize: 12, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
                    📖 Saber mais no Mercado Pago
                  </a>
                  <a href="https://wa.me/5511913751590?text=Preciso%20de%20ajuda%20com%20o%20Point%20Tap" target="_blank" rel="noopener"
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}>
                    🎧 Falar com suporte Arkiel
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── COMPROVANTES ── */}
      {subTab === 'receipts' && (
        <div>
          {/* Sub-tabs de categoria */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-soft)', paddingBottom: 8, overflowX: 'auto' }}>
            {[
              { key: 'all', label: 'Todos', icon: '📋', color: '#4f8ef7' },
              { key: 'b2c_client', label: 'Cliente → Empresa', icon: '👤', color: '#22c55e' },
              { key: 'b2c_catalog', label: 'Catálogo WhatsApp', icon: '🛒', color: '#f59e0b' },
              { key: 'b2b_manual', label: 'Manual (Empresa)', icon: '🏢', color: '#a78bfa' },
            ].map(cat => (
              <button key={cat.key} onClick={() => { setReceiptCategory(cat.key); loadReceipts(cat.key) }}
                style={{ padding: '8px 14px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  border: 'none', borderBottom: receiptCategory === cat.key ? `2px solid ${cat.color}` : '2px solid transparent',
                  background: receiptCategory === cat.key ? `${cat.color}15` : 'transparent',
                  color: receiptCategory === cat.key ? cat.color : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
              📄 Comprovantes{receiptCategory !== 'all' ? ` — ${receipts.length} registro(s)` : ''}
            </h3>
            <button onClick={() => setReceiptModal(true)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🏢 + Comprovante Manual
            </button>
          </div>

          {/* Stats por categoria */}
          {receiptCategory === 'all' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { cat: 'b2c_client', label: '👤 Cliente → Empresa', icon: '💚' },
                { cat: 'b2c_catalog', label: '🛒 Catálogo WhatsApp', icon: '🛍️' },
                { cat: 'b2b_manual', label: '🏢 Manual (Empresa)', icon: '📋' },
              ].map(s => {
                const count = receipts.filter(r => (r.category || 'b2c_client') === s.cat).length
                const total = receipts.filter(r => (r.category || 'b2c_client') === s.cat).reduce((sum, r) => sum + (parseFloat(r.payments?.amount) || 0), 0)
                return (
                  <div key={s.cat} className="ark-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => { setReceiptCategory(s.cat); loadReceipts(s.cat) }}>
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
                        <span style={{ fontSize: 18 }}>{r.file_type === 'pdf' ? '📄' : r.file_type === 'catalog_order' ? '🛒' : r.file_type === 'mp_confirmation' ? '💳' : '🖼️'}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: catInfo.bg, color: catInfo.color }}>{catInfo.label}</span>
                        {r.payments?.status === 'paid' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✅ Pago</span>}
                        {r.metadata?.avulso && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>Avulso</span>}
                      </div>
                      <button onClick={() => deleteReceipt(r.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
                    </div>
                    {r.payments && parseFloat(r.payments.amount) > 0 ? (
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>R$ {parseFloat(r.payments.amount).toFixed(2)} — {r.payments.description || 'Pagamento'}</div>
                    ) : (
                      <div style={{ color: cat === 'b2b_manual' ? '#a78bfa' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{r.notes || 'Sem valor informado'}</div>
                    )}
                    {r.file_type === 'pdf' && r.file_url && <a href={r.file_url} target="_blank" rel="noopener" style={{ color: '#4f8ef7', fontSize: 12, textDecoration: 'none' }}>📎 Ver PDF</a>}
                    {r.file_type === 'image' && r.file_url && !r.file_url.startsWith('__media__') && (
                      <a href={r.file_url} target="_blank" rel="noopener"><img src={r.file_url} alt="Comprovante" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', marginTop: 4 }} /></a>
                    )}
                    {r.file_type === 'catalog_order' && r.metadata?.items && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{r.metadata.items.length} item(ns) — R$ {parseFloat(r.metadata.total || 0).toFixed(2)}</div>}
                    {r.file_type === 'mp_confirmation' && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Confirmado via Mercado Pago</div>}
                    {(cat === 'b2b_manual' || r.metadata?.avulso) && (!r.payments || parseFloat(r.payments.amount) === 0) && editingReceipt !== r.id && (
                      <button onClick={() => setEditingReceipt(r.id)} style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(167,139,246,0.3)', background: 'transparent', color: '#a78bfa', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>✏️ Definir valor</button>
                    )}
                    {editingReceipt === r.id && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <input type="number" step="0.01" placeholder="R$" id={`edit-val-${r.id}`} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} />
                        <button onClick={() => { const v = document.getElementById(`edit-val-${r.id}`).value; if (v) updateReceipt(r.id, v, r.notes) }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setEditingReceipt(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </div>
                    )}
                    <div style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 6 }}>{r.uploaded_by} • {new Date(r.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal upload manual */}
          {receiptModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setReceiptModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 440, width: '90%', border: '1px solid rgba(167,139,246,0.25)' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🏢 Comprovante Manual</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>Para pagamentos fora do WhatsApp (maquininha, dinheiro, etc)</p>
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Valor (R$) *</label>
                <input type="number" step="0.01" min="0.01" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)} placeholder="Ex: 50.00"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 12 }} />
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição</label>
                <input value={receiptNotes} onChange={e => setReceiptNotes(e.target.value)} placeholder="Ex: Maquininha — Venda presencial"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 16 }} />
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Comprovante (imagem ou PDF)</label>
                <input type="file" accept="image/*,application/pdf" id="receipt-file" style={{ width: '100%', color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setReceiptModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={() => { const f = document.getElementById('receipt-file').files[0]; if (!receiptAmount) { alert('Informe o valor'); return } if (f) uploadReceipt(f); else alert('Selecione um arquivo') }}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Registrar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
