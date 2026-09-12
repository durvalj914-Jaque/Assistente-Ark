import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { GOOGLE_PLAY_PACKAGE } from '../../lib/plans'

/**
 * Gera features legíveis a partir dos limits do plano (tabela plans)
 * Alinha com as linhas configuradas na aba Planos do painel
 */
function featuresFromLimits(limits = {}) {
  const feats = []
  const l = limits

  // Bots
  if (l.max_bots >= 999) feats.push('Bots ilimitados')
  else if (l.max_bots) feats.push(`${l.max_bots} bot${l.max_bots > 1 ? 's' : ''}`)

  // Conversas
  if (l.max_conversations_month >= 999999) feats.push('Conversas ilimitadas')
  else if (l.max_conversations_month) feats.push(`${Number(l.max_conversations_month).toLocaleString('pt-BR')} conversas iniciadas/mês`)
  else if (l.max_conversations_month === 0) feats.push('Conversas iniciadas via créditos pré-pagos')

  // Mensagens service
  if (l.max_messages_month >= 999999) feats.push('Mensagens ilimitadas')
  else if (l.max_messages_month) feats.push(`${Number(l.max_messages_month).toLocaleString('pt-BR')} mensagens/mês`)

  // Contatos
  if (l.max_contacts >= 999999) feats.push('Contatos ilimitados')
  else if (l.max_contacts) feats.push(`${Number(l.max_contacts).toLocaleString('pt-BR')} contatos`)

  // Flow Editor
  if (l.has_flow_editor) feats.push('Editor de fluxos avançado')

  // IA
  if (l.has_ai) feats.push('Respostas com IA')

  // Catálogo
  if (l.has_catalog) feats.push('Catálogo de produtos no WhatsApp')

  // PIX
  if (l.has_pix) feats.push('Pagamentos via PIX')

  // Mercado Pago
  if (l.has_mercadopago) feats.push('Mercado Pago integrado')

  // Multiusuário
  if (l.has_multiuser) feats.push('Multiusuário')

  // API
  if (l.has_api) feats.push('Acesso à API + Webhooks')

  // Relatórios
  if (l.has_reports) feats.push('Relatórios avançados')

  // Push
  if (l.has_push) feats.push('Notificações push')

  // Google Import
  if (l.has_google_import) feats.push('Importação de contatos Google')

  // Número dedicado
  if (l.has_dedicated_number) feats.push('Número WhatsApp dedicado')

  // Suporte
  const supportLabels = { email: 'Suporte por e-mail', priority: 'Suporte prioritário', vip: 'Suporte VIP', dedicated: 'Gerente de conta dedicado' }
  if (l.support_level && supportLabels[l.support_level]) feats.push(supportLabels[l.support_level])

  // Storage
  if (l.storage_gb && l.storage_gb >= 100) feats.push('Armazenamento ilimitado')
  else if (l.storage_gb) feats.push(`${l.storage_gb} GB de armazenamento`)

  return feats.length > 0 ? feats : ['Painel básico']
}

export default function Upgrade() {
  const router = useRouter()
  const { user, tenant, loading } = useTenant()
  const [data, setData] = useState(null)
  const [fetching, setFetching] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [token, setToken] = useState({ purchaseToken: '', productId: '', orderId: '' })
  const [showVerify, setShowVerify] = useState(false)
  // Créditos de conversas (compra de Mensagens Iniciais / Marketing)
  const [credits, setCredits] = useState({ utility: 0, marketing: 0, utility_total_purchased: 0, marketing_total_purchased: 0, utility_total_used: 0, marketing_total_used: 0 })
  const [showBuyModal, setShowBuyModal] = useState(null) // 'utility' | 'marketing'
  const [buyQty, setBuyQty] = useState(100)
  const [buyResult, setBuyResult] = useState(null)
  const [buying, setBuying] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/assistente-ark/entrar')
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    loadPlans()
  }, [user])

  useEffect(() => {
    if (tenant?.id) loadCredits(tenant.id)
  }, [tenant?.id])

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
      if (data.ok && tenant?.id) loadCredits(tenant.id)
    } catch (e) {
      setBuyResult({ error: e.message })
    }
    setBuying(false)
  }

  function copyPix() {
    if (buyResult?.pix_code) {
      navigator.clipboard.writeText(buyResult.pix_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function loadPlans() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/billing/plans', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const json = await res.json()
      if (res.ok) setData(json)
    } catch {}
    setFetching(false)
  }

  async function verifyPurchase() {
    setVerifying(true); setVerifyMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/billing/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...token, tenantId: tenant?.id })
      })
      const json = await res.json()
      if (res.ok) {
        setVerifyMsg(`✅ Plano ${json.plan} ativado! Recarregue a página.`)
        setTimeout(() => window.location.reload(), 2000)
      } else setVerifyMsg(`❌ ${json.error || 'Falha na verificação'}`)
    } catch (e) { setVerifyMsg('❌ Erro: ' + e.message) }
    setVerifying(false)
  }

  if (loading || fetching) return <AdminLayout tenant={tenant} user={user}><div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Carregando planos…</div></AdminLayout>

  const dynamicPlans = (data?.plans || []).filter(p => p.active !== false)
  const resources = data?.resources || []
  const currentPlan = (data?.currentPlan || tenant?.plan || 'free').toLowerCase()
  const usage = data?.usage

  const cycleLabel = { monthly: '/mês', quarterly: '/trimestre', yearly: '/ano', lifetime: 'único', custom: '' }

  // Determinar qual plano é "featured" (RECOMENDADO)
  // Prioridade: Pro > plano com preço intermediário > segundo plano
  const featuredIdx = dynamicPlans.findIndex(p => p.name?.toLowerCase() === 'pro')
  const finalFeaturedIdx = featuredIdx >= 0 ? featuredIdx : (dynamicPlans.length > 1 ? 1 : 0)

  // Preparar planos para exibição: dinâmicos com features geradas dos limits
  const displayPlans = dynamicPlans.map(p => {
    // A matriz de limites da aba Planos é a fonte da verdade — features estáticas só como fallback
    const hasLimits = p.limits && Object.keys(p.limits).length > 0
    const feats = hasLimits ? featuresFromLimits(p.limits) : (p.features && p.features.length > 0 ? p.features : ['Painel básico'])
    return { ...p, _features: feats }
  })

  // Fallback hardcoded (só se não houver planos dinâmicos)


  // Group resources by category
  const resByCat = resources.reduce((acc, r) => {
    const cat = r.category || 'outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})
  const catLabels = { bot: 'Bots', mensagens: 'Mensagens', contatos: 'Contatos', integracao: 'Integrações', suporte: 'Suporte', geral: 'Geral', conversas: 'Conversas' }

  return (
    <AdminLayout tenant={tenant} user={user}>
      <style>{`
        .upg-title { font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
        .upg-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
        .upg-current-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #22c55e; font-weight: 600; margin-bottom: 20px; }
        .upg-usage-bar { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 12px; padding: 16px; margin-bottom: 28px; }
        .upg-usage-bar-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
        .upg-usage-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .upg-usage-bar-track { flex: 1; height: 8px; background: var(--bg-secondary); border-radius: 100px; overflow: hidden; }
        .upg-usage-bar-fill { height: 100%; border-radius: 100px; transition: width 0.3s; }
        .upg-usage-label { font-size: 11px; color: var(--text-muted); min-width: 120px; }
        .upg-usage-val { font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .upg-section { margin-bottom: 32px; }
        .upg-section-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .upg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .upg-card { border: 1px solid var(--border-soft); border-radius: 16px; padding: 24px 20px; position: relative; background: var(--bg-card); transition: border-color 0.2s; }
        .upg-card:hover { border-color: var(--border-medium); }
        .upg-card.featured { border-color: rgba(79,142,247,0.35); background: rgba(79,142,247,0.04); }
        .upg-popular { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg,#4f8ef7,#06b6d4); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 3px 12px; border-radius: 100px; white-space: nowrap; }
        .upg-plan-name { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; }
        .upg-price { font-size: 28px; font-weight: 900; color: var(--text-primary); letter-spacing: -1px; margin-bottom: 2px; }
        .upg-price-sub { font-size: 11px; color: var(--text-muted); margin-bottom: 16px; }
        .upg-feats { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
        .upg-feat { font-size: 12px; color: var(--text-secondary); display: flex; gap: 8px; line-height: 1.5; }
        .upg-btn { display: block; text-align: center; padding: 10px; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s; border: none; cursor: pointer; font-family: inherit; }
        .upg-btn-ghost { border: 1px solid var(--border-medium); color: var(--text-secondary); background: transparent; }
        .upg-btn-ghost:hover { background: var(--bg-secondary); }
        .upg-btn-solid { background: linear-gradient(135deg,#4f8ef7,#06b6d4); color: #fff; }
        .upg-btn-current { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); cursor: default; }
        .upg-res-card { border: 1px solid var(--border-soft); border-radius: 12px; padding: 16px 14px; background: var(--bg-card); transition: all 0.2s; }
        .upg-res-card:hover { border-color: var(--border-medium); transform: translateY(-2px); }
        .upg-res-cat { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
        .upg-res-name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .upg-res-desc { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.5; }
        .upg-res-price { font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px; }
        .upg-verify { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 16px; padding: 24px 20px; margin-top: 12px; }
        .upg-verify-toggle { font-size: 13px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .upg-verify-toggle:hover { color: var(--text-secondary); }
        .upg-verify-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
        .upg-verify-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.6; }
        .upg-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .upg-field label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 5px; }
        .upg-field input { width: 100%; background: var(--bg-secondary); border: 1px solid var(--border-soft); border-radius: 8px; padding: 10px 12px; color: var(--text-primary); font-size: 12px; outline: none; font-family: inherit; }
        .upg-field input:focus { border-color: rgba(79,142,247,0.4); }
        .upg-vbtn { padding: 10px 22px; background: var(--text-primary); color: var(--bg-main); border: none; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .upg-vbtn:disabled { opacity: 0.45; cursor: not-allowed; }
        .upg-msg { margin-top: 12px; font-size: 13px; line-height: 1.6; }
        .upg-empty { text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px; }
        @media(max-width:800px){.upg-grid{grid-template-columns:1fr;}}
      `}</style>

      <h1 className="upg-title">⬆️ Upgrades & Planos</h1>
      <p className="upg-sub">Escale seu negócio com mais recursos e conversas.</p>
      <div className="upg-current-badge">● Plano atual: {currentPlan === 'free' ? 'Free' : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</div>

      {/* Uso atual */}
      {usage && (
        <div className="upg-usage-bar">
          <div className="upg-usage-bar-title">📊 Uso este mês</div>
          <div className="upg-usage-row">
            <span className="upg-usage-label">Conversas iniciadas</span>
            <div className="upg-usage-bar-track">
              <div className="upg-usage-bar-fill" style={{ width: '100%', background: 'linear-gradient(90deg,#4f8ef7,#06b6d4)' }} />
            </div>
            <span className="upg-usage-val">{usage.business_initiated_conversations || 0}</span>
          </div>
          <div className="upg-usage-row">
            <span className="upg-usage-label">Msgs service (grátis)</span>
            <div className="upg-usage-bar-track">
              <div className="upg-usage-bar-fill" style={{ width: '60%', background: '#22c55e' }} />
            </div>
            <span className="upg-usage-val">{usage.service_messages || 0}</span>
          </div>
        </div>
      )}

      {/* Planos dinâmicos do painel — alinhados com a aba Planos */}
      <div className="upg-section">
        <div className="upg-section-title">📦 Planos disponíveis</div>
        {displayPlans.length > 0 ? (
          <div className="upg-grid">
            {displayPlans.map((p, i) => {
              const planName = (p.name || '').toLowerCase()
              const isCurrent = planName === currentPlan
              const isFeatured = i === finalFeaturedIdx
              const isContact = p.price == null || (p.price === 0 && planName === 'enterprise') // Enterprise / preço sob consulta = falar com vendas
              const isFree = p.price === 0 && !isContact

              return (
                <div key={p.id || i} className={`upg-card ${isFeatured ? 'featured' : ''}`}>
                  {isFeatured && <span className="upg-popular">⭐ Recomendado</span>}
                  <div className="upg-plan-name">{p.name}</div>
                  <div className="upg-price">
                    {isContact ? 'Consultar' : isFree ? 'Grátis' : `R$ ${p.price.toFixed(0).replace('.', ',')}`}
                  </div>
                  <div className="upg-price-sub">
                    {isContact ? 'contato direto' : isFree ? '' : (cycleLabel[p.billing_cycle] || '/mês')}
                  </div>
                  {p.description && <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>{p.description}</p>}
                  <ul className="upg-feats">
                    {p._features.map((f, j) => (
                      <li key={j} className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>{f}</li>
                    ))}
                  </ul>
                  {isCurrent
                    ? <span className="upg-btn upg-btn-current">✓ Seu plano atual</span>
                    : isContact
                      ? <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" className="upg-btn upg-btn-ghost">💬 Falar com vendas</a>
                      : isFree
                        ? <span className="upg-btn upg-btn-ghost" style={{opacity:0.5,cursor:'default'}}>Plano básico</span>
                        : <a href={`https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_PACKAGE}`} target="_blank" rel="noreferrer" className={`upg-btn ${isFeatured ? 'upg-btn-solid' : 'upg-btn-ghost'}`}>Assinar →</a>
                  }
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Nenhum plano disponível no momento. Configure planos na aba Planos do painel.
          </div>
        )}
      </div>

      {/* Pacotes/Recursos avulsos */}
      {resources.length > 0 && (
        <div className="upg-section">
          <div className="upg-section-title">🧩 Pacotes & Recursos avulsos</div>
          <div className="upg-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {Object.entries(resByCat).map(([cat, items]) => (
              items.map(r => (
                <div key={r.id} className="upg-res-card">
                  <div className="upg-res-cat">{catLabels[cat] || cat}</div>
                  <div className="upg-res-name">{r.name}</div>
                  <div className="upg-res-desc">{r.description}</div>
                  <div className="upg-res-price">R$ {r.price?.toFixed(2) || '0,00'}</div>
                  <a href={`https://wa.me/5511913751590?text=Quero%20contratar:%20${encodeURIComponent(r.name)}`} target="_blank" rel="noreferrer" className="upg-btn upg-btn-ghost" style={{fontSize:12,padding:'8px'}}>Contratar</a>
                </div>
              ))
            ))}
          </div>
        </div>
      )}

      {/* 💠 Créditos de Conversas — adesão pré-paga */}
      <div className="upg-section">
        <div className="upg-section-title">💠 Créditos de Conversas</div>
        <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:16}}>
          Cada conversa iniciada por você no WhatsApp consome 1 crédito. Respostas de clientes dentro de 24h são sempre gratuitas.
        </p>
        <div className="upg-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {/* Utility */}
          <div className="upg-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="upg-plan-name">💬 Mensagens Iniciais</div>
            <div className="upg-price">{credits.utility}</div>
            <div className="upg-price-sub">créditos disponíveis</div>
            <ul className="upg-feats">
              <li className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>R$0,05 por conversa iniciada</li>
              <li className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>Confirmações, lembretes, cobranças</li>
              <li className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>Inclui custo Meta + taxa Arkiel</li>
            </ul>
            <button className="upg-btn upg-btn-solid" style={{ marginTop: 'auto' }} onClick={() => { setShowBuyModal('utility'); setBuyQty(100); setBuyResult(null); setCopied(false) }}>
              Comprar créditos
            </button>
          </div>
          {/* Marketing */}
          <div className="upg-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="upg-plan-name">📣 Marketing</div>
            <div className="upg-price">{credits.marketing}</div>
            <div className="upg-price-sub">créditos disponíveis</div>
            <ul className="upg-feats">
              <li className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>R$0,36 por conversa iniciada</li>
              <li className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>Promoções, ofertas e novidades</li>
              <li className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>Inclui custo Meta + taxa Arkiel</li>
            </ul>
            <button className="upg-btn upg-btn-solid" style={{ marginTop: 'auto', background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }} onClick={() => { setShowBuyModal('marketing'); setBuyQty(100); setBuyResult(null); setCopied(false) }}>
              Comprar créditos
            </button>
          </div>
        </div>
      </div>

      {/* Verificação de compra */}
      <div className="upg-section">
        <div className="upg-verify-toggle" onClick={() => setShowVerify(s => !s)}>
          {showVerify ? '▼' : '▶'} Já comprou? Ativar plano
        </div>
        {showVerify && (
          <div className="upg-verify">
            <div className="upg-verify-title">Ativar plano via Google Play</div>
            <p className="upg-verify-sub">Cole os dados do e-mail de confirmação do Google para ativar imediatamente.</p>
            <div className="upg-fields">
              <div className="upg-field"><label>Purchase Token</label><input placeholder="Token da compra" value={token.purchaseToken} onChange={e => setToken(t=>({...t,purchaseToken:e.target.value}))} /></div>
              <div className="upg-field"><label>Product ID</label><input placeholder="Ex: ark_pro_monthly" value={token.productId} onChange={e => setToken(t=>({...t,productId:e.target.value}))} /></div>
              <div className="upg-field"><label>Order ID</label><input placeholder="Ex: GPA.1234-5678-9012" value={token.orderId} onChange={e => setToken(t=>({...t,orderId:e.target.value}))} /></div>
            </div>
            <button className="upg-vbtn" onClick={verifyPurchase} disabled={verifying||!token.purchaseToken||!token.productId}>
              {verifying ? 'Verificando…' : 'Verificar e ativar'}
            </button>
            {verifyMsg && <div className="upg-msg">{verifyMsg}</div>}
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
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16, marginTop: 6, marginBottom: 16 }} />

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[50, 100, 500, 1000].map(q => (
                    <button key={q} onClick={() => setBuyQty(q)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{q}</button>
                  ))}
                </div>

                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Custo Meta (WhatsApp)</span>
                    <span>R$ {(0.0374 * buyQty).toFixed(2)}</span>
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
    </AdminLayout>
  )
}
