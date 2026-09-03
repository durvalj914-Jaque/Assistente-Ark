import { useState, useEffect } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase } from '../../lib/supabase'

export default function MarketingPage() {
  const [tenant, setTenant] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState('viewer')
  const [credits, setCredits] = useState({ utility: 0, marketing: 0, utility_total_purchased: 0, marketing_total_purchased: 0, utility_total_used: 0, marketing_total_used: 0 })
  const [history, setHistory] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(null)
  const [showBuyModal, setShowBuyModal] = useState(null) // 'utility' | 'marketing'
  const [buyQty, setBuyQty] = useState(100)
  const [buyResult, setBuyResult] = useState(null)
  const [copied, setCopied] = useState(false)

  // Compose marketing message
  const [showSendModal, setShowSendModal] = useState(false)
  const [recipients, setRecipients] = useState('') // 'all' | 'selected'
  const [selectedContacts, setSelectedContacts] = useState([])
  const [contacts, setContacts] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    loadSession()
  }, [])

  async function loadSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    setUser(session.user)

    const { data: tm } = await supabase
      .from('tenant_members')
      .select('role, tenants(*)')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (tm?.tenants) {
      setTenant(tm.tenants)
      setRole(tm.role || 'viewer')
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      setProfile(prof)
      await loadCredits(tm.tenants.id)
      await loadHistory(tm.tenants.id)
      await loadPurchases(tm.tenants.id)
      await loadContacts(tm.tenants.id)
    }
    setLoading(false)
  }

  async function loadCredits(tid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/credits/balance?tenant_id=${tid}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (!data.error) setCredits(data)
    } catch (e) { console.error('loadCredits:', e) }
  }

  async function loadHistory(tid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/credits/history?tenant_id=${tid}&limit=20`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (!data.error) setHistory(data.usage || [])
    } catch (e) { console.error('loadHistory:', e) }
  }

  async function loadPurchases(tid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/credits/purchase?tenant_id=${tid}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (!data.error) setPurchases(data.purchases || [])
    } catch (e) { console.error('loadPurchases:', e) }
  }

  async function loadContacts(tid) {
    try {
      const { data, error } = await supabase.from('contacts').select('id,phone,name').eq('tenant_id', tid).limit(500)
      if (!error) setContacts(data || [])
    } catch (e) {}
  }

  async function handleBuy() {
    if (!tenant || !showBuyModal) return
    setBuying(true)
    setBuyResult(null)
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          credit_type: showBuyModal,
          quantity: parseInt(buyQty),
        }),
      })
      const data = await res.json()
      setBuyResult(data)
      if (data.ok) {
        // Não recarregar saldo ainda — só após pagamento confirmado
      }
    } catch (e) {
      setBuyResult({ error: e.message })
    }
    setBuying(false)
  }

  async function handleSendMarketing() {
    if (!tenant || !msgText.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      // Enviar via API de broadcast de marketing
      const targetContacts = recipients === 'all' ? contacts : contacts.filter(c => selectedContacts.includes(c.id))
      const res = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          message: msgText,
          contacts: targetContacts.map(c => c.phone),
        }),
      })
      const data = await res.json()
      setSendResult(data)
      if (data.ok) {
        setShowSendModal(false)
        setMsgText('')
        await loadCredits(tenant.id)
      }
    } catch (e) {
      setSendResult({ error: e.message })
    }
    setSending(false)
  }

  function copyPix() {
    if (buyResult?.pix_code) {
      navigator.clipboard.writeText(buyResult.pix_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return <AdminLayout><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div></AdminLayout>
  }

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <Head><title>Marketing — Assistente Ark</title></Head>

      {/* HEADER */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📣 Marketing & Créditos</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Envie mensagens proativas e gerencie seus créditos pré-pagos para conversas no WhatsApp.
        </p>
      </div>

      {/* EXPLICAÇÃO DE COBRANÇA */}
      <div style={{ margin: '16px 20px', padding: 20, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-soft)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>ℹ️ Como funciona a cobrança</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>💬</span>
            <div>
              <strong>Mensagens Iniciais (Utility)</strong> — R$0,05 por conversa<br />
              <span style={{ color: 'var(--text-muted)' }}>Quando você inicia uma conversa com um cliente (confirmação de pedido, lembrete, etc.). Inclui R$0,04 (custo Meta) + R$0,01 (taxa Arkiel).</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>📣</span>
            <div>
              <strong>Mensagens de Marketing</strong> — R$0,36 por conversa<br />
              <span style={{ color: 'var(--text-muted)' }}>Quando você envia uma promoção, oferta ou novidade. Inclui R$0,34 (custo Meta) + R$0,02 (taxa Arkiel).</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div>
              <strong>Respostas de clientes</strong> — Gratuito<br />
              <span style={{ color: 'var(--text-muted)' }}>Quando um cliente inicia a conversa ou responde dentro de 24h, não há cobrança. Apenas conversas iniciadas por você consomem créditos.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            <div>
              <strong>Recarga automática</strong><br />
              <span style={{ color: 'var(--text-muted)' }}>Cada conversa iniciada debita 1 crédito do saldo. Compre mais créditos antes que o saldo acabe para não interromper o atendimento.</span>
            </div>
          </div>
        </div>
      </div>

      {/* CARDS DE CRÉDITOS */}
      <div style={{ display: 'flex', gap: 16, padding: '0 20px 20px', flexWrap: 'wrap' }}>
        {/* Utility Credits */}
        <div style={{ flex: 1, minWidth: 280, padding: 20, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>💬 MENSSAGENS INICIAIS</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{credits.utility}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>créditos disponíveis</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>R$0,05/cada</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>usadas: {credits.utility_total_used}</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: credits.utility_total_purchased > 0 ? `${(credits.utility / credits.utility_total_purchased) * 100}%` : '0%', background: 'linear-gradient(90deg,#4f8ef7,#06b6d4)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <button onClick={() => { setShowBuyModal('utility'); setBuyQty(100); setBuyResult(null); setCopied(false) }}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Comprar créditos
          </button>
        </div>

        {/* Marketing Credits */}
        <div style={{ flex: 1, minWidth: 280, padding: 20, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>📣 MARKETING</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{credits.marketing}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>créditos disponíveis</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>R$0,36/cada</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>usadas: {credits.marketing_total_used}</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ height: '100%', width: credits.marketing_total_purchased > 0 ? `${(credits.marketing / credits.marketing_total_purchased) * 100}%` : '0%', background: 'linear-gradient(90deg,#f59e0b,#ef4444)', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowBuyModal('marketing'); setBuyQty(100); setBuyResult(null); setCopied(false) }}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Comprar
            </button>
            <button onClick={() => setShowSendModal(true)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* HISTÓRICO DE USO */}
      <div style={{ padding: '0 20px 20px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>📋 Últimas conversas cobradas</h3>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
            Nenhuma conversa cobrada ainda. Quando você enviar mensagens proativas, o histórico aparecerá aqui.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{h.credit_type === 'marketing' ? '📣' : '💬'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{h.credit_type === 'marketing' ? 'Marketing' : 'Mensagem inicial'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(h.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>R$ {parseFloat(h.cost_brl).toFixed(4)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: COMPRAR CRÉDITOS */}
      {showBuyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowBuyModal(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              Comprar {showBuyModal === 'marketing' ? '📣 Marketing' : '💬 Mensagens Iniciais'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {showBuyModal === 'marketing' ? 'R$0,36 por crédito (inclui custo Meta + taxa Arkiel)' : 'R$0,05 por crédito (inclui custo Meta + taxa Arkiel)'}
            </p>

            {!buyResult && (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Quantidade de créditos</label>
                <input type="number" value={buyQty} onChange={e => setBuyQty(e.target.value)} min="1" max="100000"
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16, marginTop: 6, marginBottom: 16 }} />
                
                {/* Botões rápidos */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[50, 100, 500, 1000].map(q => (
                    <button key={q} onClick={() => setBuyQty(q)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{q}</button>
                  ))}
                </div>

                {/* Resumo */}
                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Custo Meta (WhatsApp)</span>
                    <span>R$ {((showBuyModal === 'marketing' ? 0.0374 : 0.0374) * buyQty).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Taxa Arkiel</span>
                    <span>R$ {((showBuyModal === 'marketing' ? 0.02 : 0.01) * buyQty).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
                    <span>Total a pagar</span>
                    <span>R$ {((showBuyModal === 'marketing' ? 0.36 : 0.05) * parseInt(buyQty || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <button onClick={handleBuy} disabled={buying}
                  style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: buying ? 'not-allowed' : 'pointer', opacity: buying ? 0.6 : 1 }}>
                  {buying ? 'Gerando PIX...' : 'Gerar PIX para pagamento'}
                </button>
              </>
            )}

            {/* Resultado: PIX gerado */}
            {buyResult?.ok && buyResult.pix_code && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>💠</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>R$ {buyResult.amount.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{buyResult.quantity} créditos de {buyResult.credit_label}</div>
                </div>
                {buyResult.pix_qr && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <img src={buyResult.pix_qr} alt="QR Code PIX" style={{ width: 200, height: 200, borderRadius: 12, border: '1px solid var(--border-soft)' }} />
                  </div>
                )}
                <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PIX Copia e Cola:</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-primary)', maxHeight: 50, overflow: 'hidden' }}>
                    {buyResult.pix_code.substring(0, 80)}...
                  </div>
                </div>
                <button onClick={copyPix} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: copied ? '#10b981' : 'var(--bg-secondary)', color: copied ? '#fff' : 'var(--text-primary)', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
                  {copied ? '✅ Copiado!' : '📋 Copiar código PIX'}
                </button>
                <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 10, fontSize: 11, color: '#15803d', textAlign: 'center' }}>
                  ✅ Após o pagamento, os créditos serão liberados automaticamente.
                </div>
              </div>
            )}

            {/* Resultado sem PIX (fallback) */}
            {buyResult?.ok && !buyResult.pix_code && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💳</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>R$ {buyResult.amount?.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{buyResult.quantity} créditos de {buyResult.credit_label}</div>
                <div style={{ padding: 12, background: '#fef3c7', borderRadius: 10, fontSize: 12, color: '#92400e' }}>
                  ⚠️ {buyResult.message || 'Entre em contato para efetuar o pagamento.'}
                </div>
              </div>
            )}

            {buyResult?.error && (
              <div style={{ padding: 12, background: '#fef2f2', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                ❌ {buyResult.error}
              </div>
            )}

            <button onClick={() => setShowBuyModal(null)} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 12 }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR MARKETING */}
      {showSendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowSendModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📣 Enviar mensagem de marketing</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Cada contato que receber esta mensagem consumirá 1 crédito de marketing (R$0,36). Você tem {credits.marketing} créditos.
            </p>

            {/* Destinatários */}
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Destinatários</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setRecipients('all')} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${recipients === 'all' ? '#4f8ef7' : 'var(--border-soft)'}`, background: recipients === 'all' ? 'var(--blue-tint)' : 'var(--bg-secondary)', color: recipients === 'all' ? '#4f8ef7' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Todos ({contacts.length})
              </button>
              <button onClick={() => setRecipients('selected')} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${recipients === 'selected' ? '#4f8ef7' : 'var(--border-soft)'}`, background: recipients === 'selected' ? 'var(--blue-tint)' : 'var(--bg-secondary)', color: recipients === 'selected' ? '#4f8ef7' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Selecionar
              </button>
            </div>

            {recipients === 'selected' && (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-soft)', borderRadius: 8, marginBottom: 12 }}>
                {contacts.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }}>
                    <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={e => {
                      if (e.target.checked) setSelectedContacts([...selectedContacts, c.id])
                      else setSelectedContacts(selectedContacts.filter(id => id !== c.id))
                    }} />
                    <span style={{ fontSize: 13 }}>{c.name || c.phone}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Mensagem */}
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Mensagem</label>
            <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Digite sua mensagem de marketing..." rows={5}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', marginBottom: 12 }} />

            {/* Resumo de custos */}
            <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Destinatários</span>
                <span>{recipients === 'all' ? contacts.length : selectedContacts.length} contatos</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Créditos necessários</span>
                <span style={{ fontWeight: 600 }}>{recipients === 'all' ? contacts.length : selectedContacts.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Custo total</span>
                <span>R$ {((recipients === 'all' ? contacts.length : selectedContacts.length) * 0.36).toFixed(2)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Seu saldo</span>
                <span style={{ color: credits.marketing >= (recipients === 'all' ? contacts.length : selectedContacts.length) ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {credits.marketing} créditos {credits.marketing >= (recipients === 'all' ? contacts.length : selectedContacts.length) ? '✅' : '⚠️ insuficiente'}
                </span>
              </div>
            </div>

            {sendResult?.error && (
              <div style={{ padding: 12, background: '#fef2f2', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>❌ {sendResult.error}</div>
            )}
            {sendResult?.ok && (
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 10, fontSize: 13, color: '#15803d', marginBottom: 12 }}>
                ✅ {sendResult.sent || sendResult.queued} mensagens enviadas! Créditos debitados.
              </div>
            )}

            <button onClick={handleSendMarketing} disabled={sending || !msgText.trim() || credits.marketing < (recipients === 'all' ? contacts.length : selectedContacts.length)}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (sending || !msgText.trim() || credits.marketing < (recipients === 'all' ? contacts.length : selectedContacts.length)) ? 'not-allowed' : 'pointer', opacity: (sending || !msgText.trim() || credits.marketing < (recipients === 'all' ? contacts.length : selectedContacts.length)) ? 0.6 : 1 }}>
              {sending ? 'Enviando...' : 'Enviar agora'}
            </button>

            <button onClick={() => setShowSendModal(false)} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
