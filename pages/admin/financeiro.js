import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

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

  const authHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token || ''}` }
  }, [])

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
      const res = await fetch(`/api/mercadopago/methods?tenant_id=${tenantId}`, { headers: h })
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
    if (subTab === 'payment_methods') loadPaymentMethods('payment')
    else if (subTab === 'billing_methods') { loadPaymentMethods('billing'); loadPendingPayments() }
    else if (subTab === 'receipts') { loadReceipts('all'); loadPayments() }
    else if (subTab === 'history') { loadPayments() }
  }, [user, subTab])



  if (loading || !user) return <AdminLayout tenant={tenant} user={user} role={role} profile={profile}><div style={{ padding: 40, color: '#64748b' }}>Carregando...</div></AdminLayout>

  const SUB_TABS = [
    { key: 'payment_methods', label: 'Formas de Pagamento', icon: '💳', desc: 'Como você paga' },
    { key: 'billing_methods', label: 'Formas de Cobrança', icon: '📥', desc: 'Como você recebe' },
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
    billing: [
      { name: 'PIX', icon: '💠', key_label: 'Chave PIX para recebimento' },
      { name: 'Mercado Pago', icon: '🟡', key_label: 'Token ou Email MP' },
      { name: 'Cartão (Maquininha)', icon: '💳', key_label: 'Modelo da maquininha' },
      { name: 'Dinheiro', icon: '💵', key_label: '' },
      { name: 'Transferência Bancária', icon: '🏦', key_label: 'Conta bancária' },
      { name: 'PayPal', icon: '🅿️', key_label: 'Email PayPal' },
      { name: 'Stripe', icon: '🔷', key_label: 'Stripe Key' },
    ],
  }

  const currentType = subTab === 'payment_methods' ? 'payment' : 'billing'
  const currentPresets = PM_PRESETS[currentType] || []

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>💰 Financeiro</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gerencie suas formas de pagamento, cobranças e comprovantes</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: 4, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', overflowX: 'auto' }}>
        {SUB_TABS.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            style={{
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: subTab === st.key ? 700 : 500,
              border: 'none',
              background: subTab === st.key ? '#4f8ef7' : 'transparent',
              color: subTab === st.key ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: 16 }}>{st.icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>{st.label}</span>
              <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>{st.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Status Mercado Pago (sempre visivel) ── */}
      <div className="ark-card" style={{ padding: '14px 18px', marginBottom: 16, border: mpConnected ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(0,158,227,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{mpConnected ? '✅' : '🟡'}</span>
          <div>
            <div style={{ color: mpConnected ? '#22c55e' : 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>
              {mpConnected ? `Mercado Pago conectado${mpUser ? ` — ${mpUser}` : ''}` : 'Mercado Pago — usando conta da plataforma'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
              {mpConnected
                ? `Sua conta própria • Taxa Arkiel: ${feeConfig.pix}% (PIX) / ${feeConfig.credit_card}% (Crédito) • Confirmação automática via webhook`
                : `Conecte sua própria conta para receber direto • Taxa Arkiel: ${feeConfig.pix}%-${feeConfig.credit_card}% por transação`}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa Arkiel:</span>
              <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeConfig.pix}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa MP:</span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>Grátis</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Você recebe (R$100):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ {(100 - feeConfig.pix).toFixed(2)}</span>
            </div>
          </div>
          {/* Crédito */}
          <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>💳</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>Crédito</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa Arkiel:</span>
              <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeConfig.credit_card}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa MP:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>~4,99%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Você recebe (R$100):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ {(100 - feeConfig.credit_card - 4.99).toFixed(2)}</span>
            </div>
          </div>
          {/* Débito */}
          <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>💳</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>Débito</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa Arkiel:</span>
              <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeConfig.debit_card}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa MP:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>~2,39%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Você recebe (R$100):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ {(100 - feeConfig.debit_card - 2.39).toFixed(2)}</span>
            </div>
          </div>
          {/* Boleto */}
          <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🧾</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>Boleto</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa Arkiel:</span>
              <span style={{ color: '#4f8ef7', fontWeight: 700 }}>{feeConfig.boleto}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)' }}>Taxa MP:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ 3,99</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Você recebe (R$100):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>R$ {(100 - feeConfig.boleto - 3.99).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          * Taxas do MP (à vista) podem variar conforme plano da conta (Standard/Pro/Premium) e promoções. Taxa da Arkiel é configurável no painel admin em Pagamentos → Taxas da Plataforma.
        </div>
      </div>

      {/* Feedback da desconexão MP */}
      {mpDisconnectResult && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10,
          background: mpDisconnectResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${mpDisconnectResult.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          fontSize: 13, color: mpDisconnectResult.success ? '#10b981' : '#ef4444',
        }}>
          {mpDisconnectResult.success ? '✅ ' : '❌ '}{mpDisconnectResult.message}
        </div>
      )}

      {/* ── FORMAS DE PAGAMENTO / COBRANÇA ── */}
      {(subTab === 'payment_methods' || subTab === 'billing_methods') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
              {subTab === 'payment_methods' ? '💳 Formas de Pagamento' : '📥 Formas de Cobrança'}
            </h3>
            <button onClick={() => { setPmForm({ method_name: '', method_key: '', is_active: true }); setPmModal({ type: currentType, editing: null }) }}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Adicionar
            </button>
          </div>

          {/* Formas de pagamento disponíveis no Mercado Pago */}
          {subTab === 'billing_methods' && (
            <div className="ark-card" style={{ padding: 20, marginBottom: 16, border: '1px solid var(--border-soft)' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  Formas de pagamento disponíveis
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {mpConnected ? `Gerenciado pela sua conta MP${mpUser ? ` (${mpUser})` : ''}` : 'Gerenciado pela conta da plataforma Arkiel'}
                </div>
              </div>

              {/* Info da conta conectada - so quando conectado */}
              {mpConnected && mpAccount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>👤</span>
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
                        {mpAccount.first_name || mpAccount.nickname || 'Conta MP'}
                        {mpAccount.last_name ? ' ' + mpAccount.last_name : ''}
                      </div>
                      {mpAccount.email && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{mpAccount.email}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ height: 24, width: 1, background: 'var(--border-soft)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'monospace' }}>{mpAccount.id}</span>
                  </div>
                  <div style={{ height: 24, width: 1, background: 'var(--border-soft)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{mpAccount.type === 'standard' ? 'Pessoa Física' : mpAccount.type === 'seller' ? 'Vendedor' : mpAccount.type}</span>
                  </div>
                  <div style={{ height: 24, width: 1, background: 'var(--border-soft)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: mpAccount.status === 'active' ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
                    <span style={{ color: mpAccount.status === 'active' ? '#22c55e' : 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>
                      {mpAccount.status === 'active' ? 'Ativa' : mpAccount.status === 'pending' ? 'Pendente' : mpAccount.status}
                    </span>
                  </div>
                  <div style={{ height: 24, width: 1, background: 'var(--border-soft)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>País</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{mpAccount.country || 'BR'}</span>
                  </div>
                  {mpAccount.nickname && (
                    <>
                      <div style={{ height: 24, width: 1, background: 'var(--border-soft)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Apelido</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>@{mpAccount.nickname}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Formas de cobrança vinculadas à conta - so quando MP conectado */}
              {mpConnected && (
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Formas de cobrança vinculadas à conta
                    </div>
                    {loadingMpMethods ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>Buscando formas disponíveis...</div>
                    ) : mpAvailableMethods.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {mpAvailableMethods.map(cat => {
                          const isActive = mpMethods[cat.key] !== false
                          const methodsList = cat.methods.map(m => m.name).join(', ')
                          return (
                            <div key={cat.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-soft)', background: isActive ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{cat.label}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{methodsList}</div>
                                </div>
                              </div>
                              <button onClick={() => toggleMPMethod(cat.key)} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: isActive ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)', color: isActive ? '#22c55e' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                                {isActive ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                        {['pix', 'credit_card', 'debit_card', 'boleto'].map(key => {
                          const labels = { pix: { label: 'PIX', icon: '💸', desc: 'Copia e cola + QR Code' }, credit_card: { label: 'Cartão de Crédito', icon: '💳', desc: 'Parcelamento via Checkout MP' }, debit_card: { label: 'Cartão de Débito', icon: '💳', desc: 'Débito online via Checkout MP' }, boleto: { label: 'Boleto Bancário', icon: '🧾', desc: 'Compensação em 1-2 dias úteis' } }
                          const cat = labels[key]
                          const isActive = mpMethods[key] !== false
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, border: isActive ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-soft)', background: isActive ? 'rgba(34,197,94,0.06)' : 'var(--bg-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                <div>
                                  <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{cat.label}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{cat.desc}</div>
                                </div>
                              </div>
                              <button onClick={() => toggleMPMethod(key)} style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: isActive ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)', color: isActive ? '#22c55e' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                {isActive ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
              )}
            </div>
          )}

          {/* Presets rápidos */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {currentPresets.map(preset => (
              <button key={preset.name} onClick={() => { setPmForm({ method_name: preset.name, method_key: '', is_active: true }); setPmModal({ type: currentType, editing: null }) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                <span>{preset.icon}</span> {preset.name}
              </button>
            ))}
          </div>

          {loadingPM ? (
            <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
          ) : paymentMethods.length === 0 ? (
            <div className="ark-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{subTab === 'payment_methods' ? '💳' : '📥'}</div>
              Nenhuma forma cadastrada. Clique em "Adicionar" ou escolha um preset acima.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {paymentMethods.map(m => {
                const preset = currentPresets.find(p => p.name === m.method_name)
                const icon = preset?.icon || (m.type === 'payment' ? '💳' : '📥')
                return (
                  <div key={m.id} className="ark-card" style={{ padding: 14, borderLeft: m.is_active ? '3px solid #22c55e' : '3px solid var(--border-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{icon}</span>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{m.method_name}</div>
                          {m.method_key && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{m.method_key}</div>}
                        </div>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: m.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)', color: m.is_active ? '#22c55e' : 'var(--text-muted)' }}>
                        {m.is_active ? '✅ Ativo' : '⏸️ Inativo'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button onClick={() => togglePaymentMethod(m.id, m.is_active, currentType)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                        {m.is_active ? '⏸️ Pausar' : '▶️ Ativar'}
                      </button>
                      <button onClick={() => { setPmForm({ method_name: m.method_name, method_key: m.method_key || '', is_active: m.is_active }); setPmModal({ type: m.type, editing: m.id }) }}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 11, cursor: 'pointer' }}>
                        ✏️ Editar
                      </button>
                      <button onClick={() => deletePaymentMethod(m.id, currentType)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
                        🗑️ Remover
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal add/edit */}
          {pmModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                 onClick={() => setPmModal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 420, width: '90%', border: '1px solid var(--border-medium)' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                  {pmModal.editing ? 'Editar' : 'Adicionar'} {pmModal.type === 'payment' ? 'Forma de Pagamento' : 'Forma de Cobrança'}
                </h3>
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome *</label>
                <input value={pmForm.method_name} onChange={e => setPmForm(f => ({ ...f, method_name: e.target.value }))} placeholder="Ex: PIX, Cartão, Mercado Pago..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 12 }} />
                <label style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>Chave / Detalhe</label>
                <input value={pmForm.method_key} onChange={e => setPmForm(f => ({ ...f, method_key: e.target.value }))} placeholder="Ex: arkieltech@gmail.com, Token MP..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPmModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={savePaymentMethod} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#4f8ef7', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── PAGAMENTOS PENDENTES (Formas de Cobrança) ── */}
      {subTab === 'billing_methods' && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
              ⏳ Pagamentos Pendentes
            </h3>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {pendingPayments.length > 0 ? `${pendingPayments.length} aguardando pagamento` : 'Nenhum pendente'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 14 }}>
            Pagamentos enviados via chat aos seus clientes que ainda não foram pagos. Você pode cancelar a qualquer momento.
          </p>

          {loadingPending ? (
            <div className="ark-card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Carregando pagamentos pendentes...
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="ark-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              <span style={{ fontSize: 13 }}>Nenhum pagamento pendente. Tudo em dia!</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingPayments.map(p => {
                const mpMeta = (() => { try { return JSON.parse(p.pix_qr_url || '{}') } catch { return {} } })()
                const isMP = !!mpMeta.mp_payment_id
                return (
                  <div key={p.id} className="ark-card" style={{
                    padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderLeft: '3px solid #f59e0b',
                    flexWrap: 'wrap', gap: 10
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 18 }}>{p.method === 'pix' ? '💠' : '💳'}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>
                          R$ {parseFloat(p.amount).toFixed(2)}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: 'rgba(245,158,11,0.15)', color: '#f59e0b'
                        }}>
                          ⏳ Pendente
                        </span>
                        {isMP && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                            background: 'rgba(79,142,247,0.15)', color: '#4f8ef7'
                          }}>
                            Mercado Pago
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
                        {p.description || 'Pagamento'} • Enviado em {new Date(p.created_at).toLocaleString('pt-BR')}
                      </div>
                      {p.pix_code && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(p.pix_code); alert('Código PIX copiado!') }}
                          style={{ marginTop: 6, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 10, cursor: 'pointer' }}
                        >
                          📋 Copiar código PIX
                        </button>
                      )}
                      {p.mp_checkout_url && (
                        <a href={p.mp_checkout_url} target="_blank" rel="noopener"
                          style={{ marginTop: 6, marginLeft: 6, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 10, textDecoration: 'none', display: 'inline-block' }}>
                          🔗 Ver link
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => cancelPayment(p.id)}
                      disabled={cancelingId === p.id}
                      style={{
                        padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                        fontWeight: 700, fontSize: 12, cursor: cancelingId === p.id ? 'not-allowed' : 'pointer',
                        opacity: cancelingId === p.id ? 0.5 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {cancelingId === p.id ? '⏳ Cancelando...' : '❌ Cancelar'}
                    </button>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  Total pendente: <strong style={{ color: '#f59e0b' }}>R$ {pendingPayments.reduce((s, p) => s + parseFloat(p.amount), 0).toFixed(2)}</strong>
                </span>
              </div>
            </div>
          )}

          {/* ── Point Tap: Smartphone como maquininha ── */}
          {subTab === 'billing_methods' && (
            <div className="ark-card" style={{ padding: 24, marginBottom: 20, border: '1px solid rgba(34,197,94,0.2)', position: 'relative', overflow: 'hidden' }}>
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
                    As transações do Point Tap entram no mesmo ecossistema do Mercado Pago. A taxa da Arkiel de <strong style={{ color: 'var(--text-secondary)' }}>{feeConfig.pix}%</strong> (PIX) / <strong style={{ color: 'var(--text-secondary)' }}>{feeConfig.credit_card}%</strong> (Crédito) é retida automaticamente, igual às transações online. Você não precisa configurar nada extra — basta ter a conta PJ ativa no Mercado Pago.
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
                  <strong style={{ color: 'var(--text-secondary)' }}>Exemplo:</strong> Uma venda de R$ 100 no crédito: o MP cobra ~R$ 4,99 (taxa dele) + a Arkiel cobra <strong style={{ color: 'var(--text-secondary)' }}>R$ {feeConfig.credit_card}</strong> (taxa da plataforma). O cliente B2B recebe líquido ~R$ {100 - 4.99 - feeConfig.credit_card}.
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
