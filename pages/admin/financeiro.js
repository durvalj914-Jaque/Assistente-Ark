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
  const [mpConnected, setMpConnected] = useState(false)
  const [mpConnecting, setMpConnecting] = useState(false)
  const [mpUser, setMpUser] = useState('')
  const [mpMethods, setMpMethods] = useState({ pix: true, credit_card: true, debit_card: true, boleto: true })
  const [mpAvailableMethods, setMpAvailableMethods] = useState([])
  const [loadingMpMethods, setLoadingMpMethods] = useState(false)
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

  async function loadPayConfig() {
    try {
      const h = await authHeader()
      const res = await fetch('/api/payments/config', { headers: h })
      const json = await res.json()
      if (json.config) {
        setPayConfig({ pix_key: json.config.pix_key || '', merchant_name: json.config.merchant_name || '', merchant_city: json.config.merchant_city || '', mp_access_token: json.config.mp_access_token || '' })
        setMpConnected(!!json.config.mp_access_token)
        if (json.config.mp_access_token) {
          try { 
            const parsed = JSON.parse(json.config.mp_access_token); 
            setMpUser(parsed.user_nickname || '')
            if (parsed.mp_methods) setMpMethods(parsed.mp_methods)
            // Fetch real methods from MP API
            fetchMPMethods(json.config.id)
          } catch {}
        }
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
    } catch (e) { console.error('fetchMPMethods:', e) }
    finally { setLoadingMpMethods(false) }
  }

  async function connectMP() {
    setMpConnecting(true)
    try {
      const h = await authHeader()
      const res = await fetch('/api/mercadopago/oauth/init', { headers: h })
      const json = await res.json()
      if (json.authUrl) window.location.href = json.authUrl
      else alert('Erro ao iniciar conexão: ' + (json.error || ''))
    } catch (e) { alert('Erro: ' + e.message) }
    finally { setMpConnecting(false) }
  }

  async function disconnectMP() {
    if (!confirm('Desconectar o Mercado Pago?')) return
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
    if (router.query.tab) setSubTab(router.query.tab)
  }, [router.query.tab])

  // ── LOAD ON MOUNT ──
  useEffect(() => {
    if (!user) return
    if (subTab === 'payment_methods') loadPaymentMethods('payment')
    else if (subTab === 'billing_methods') { loadPaymentMethods('billing'); loadPayConfig() }
    else if (subTab === 'receipts') { loadReceipts('all'); loadPayments() }
    else if (subTab === 'history') { loadPayments(); loadPayConfig() }
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, borderBottom: '1px solid var(--border-soft)', paddingBottom: 0, overflowX: 'auto' }}>
        {SUB_TABS.map(st => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            style={{
              padding: '10px 16px', borderRadius: '10px 10px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: subTab === st.key ? 700 : 500,
              border: 'none', borderBottom: subTab === st.key ? '2px solid #4f8ef7' : '2px solid transparent',
              background: subTab === st.key ? 'rgba(79,142,247,0.1)' : 'transparent',
              color: subTab === st.key ? '#4f8ef7' : 'var(--text-muted)',
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

          {/* Conectar Mercado Pago via OAuth (um clique) */}
          {subTab === 'billing_methods' && (
            <div className="ark-card" style={{ padding: 20, marginBottom: 16, border: mpConnected ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(0,158,227,0.25)' }}>
              {mpConnected ? (
                <div>
                  {/* Header com status e botao desconectar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 26 }}>✅</span>
                      <div>
                        <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>Mercado Pago conectado{mpUser ? ` — ${mpUser}` : ''}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>Taxa Arkiel: 2% por transação • Confirmação automática via webhook</div>
                      </div>
                    </div>
                    <button onClick={disconnectMP}
                      style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                      Desconectar
                    </button>
                  </div>

                  {/* Formas de cobrança ativas via MP */}
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
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🟡 Conecte seu Mercado Pago</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                      Receba PIX e pagamentos de cartão dos pedidos do catálogo direto na sua conta.<br />
                      A Arkiel cobra apenas 2% por transação — sem mensalidade extra.
                    </div>
                  </div>
                  <button onClick={connectMP} disabled={mpConnecting}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #009ee3, #00b1c0)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: mpConnecting ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 18 }}>🔗</span>
                    {mpConnecting ? 'Conectando...' : 'Conectar Mercado Pago'}
                  </button>
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
