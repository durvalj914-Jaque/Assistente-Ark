import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, GOOGLE_PLAY_PACKAGE } from '../../lib/plans'

export default function Upgrade() {
  const router = useRouter()
  const { user, tenant, loading } = useTenant()
  const [data, setData] = useState(null)
  const [fetching, setFetching] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [token, setToken] = useState({ purchaseToken: '', productId: '', orderId: '' })
  const [showVerify, setShowVerify] = useState(false)
  const [billingCycle, setBillingCycle] = useState('monthly')

  useEffect(() => {
    if (!loading && !user) router.replace('/assistente-ark/entrar')
  }, [user, loading])

  useEffect(() => {
    if (!user) return
    loadPlans()
  }, [user])

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

  const dynamicPlans = data?.plans || []
  const resources = data?.resources || []
  const currentPlan = data?.currentPlan || tenant?.plan || 'free'
  const usage = data?.usage

  const cycleLabel = { monthly: '/mês', quarterly: '/trimestre', yearly: '/ano', lifetime: 'único', custom: '' }

  // Hardcoded plans (fallback) 
  const hardcodedPlans = [
    { key: 'starter', ...PLANS.starter },
    { key: 'pro', ...PLANS.pro },
    { key: 'enterprise', ...PLANS.enterprise }
  ]

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
        .upg-title { font-size: 22px; font-weight: 800, color: var(--text-primary); margin-bottom: 4px; }
        .upg-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
        .upg-current-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #22c55e; font-weight: 600; margin-bottom: 20px; }
        .upg-usage-bar { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 12px; padding: 16px; margin-bottom: 28px; }
        .upg-usage-bar-title { font-size: 13px; font-weight: 600, color: var(--text-secondary); margin-bottom: 8px; }
        .upg-usage-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .upg-usage-bar-track { flex: 1; height: 8px; background: var(--bg-secondary); border-radius: 100px; overflow: hidden; }
        .upg-usage-bar-fill { height: 100%; border-radius: 100px; transition: width 0.3s; }
        .upg-usage-label { font-size: 11px; color: var(--text-muted); min-width: 120px; }
        .upg-usage-val { font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .upg-section { margin-bottom: 32px; }
        .upg-section-title { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .upg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
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
        .upg-verify-title { font-size: 15px; font-weight: 700, color: var(--text-primary); margin-bottom: 6px; }
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
      <div className="upg-current-badge">● Plano atual: {currentPlan === 'free' ? 'Free' : currentPlan}</div>

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

      {/* Planos dinâmicos do painel */}
      <div className="upg-section">
        <div className="upg-section-title">📦 Planos disponíveis</div>
        {dynamicPlans.length > 0 ? (
          <div className="upg-grid">
            {dynamicPlans.map((p, i) => {
              const isCurrent = p.name?.toLowerCase() === currentPlan?.toLowerCase()
              const isFeatured = i === 1 || (dynamicPlans.length === 1 && i === 0)
              return (
                <div key={p.id} className={`upg-card ${isFeatured ? 'featured' : ''}`}>
                  {isFeatured && <span className="upg-popular">Recomendado</span>}
                  <div className="upg-plan-name">{p.name}</div>
                  <div className="upg-price">{p.price > 0 ? `R$ ${p.price.toFixed(0)}` : 'Grátis'}</div>
                  <div className="upg-price-sub">{p.price > 0 ? cycleLabel[p.billing_cycle] || '/mês' : ''}</div>
                  {p.description && <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>{p.description}</p>}
                  <ul className="upg-feats">
                    {(p.features || []).map((f, j) => (
                      <li key={j} className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>{f}</li>
                    ))}
                  </ul>
                  {isCurrent
                    ? <span className="upg-btn upg-btn-current">Plano atual</span>
                    : p.price > 0
                      ? <a href={`https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_PACKAGE}`} target="_blank" rel="noreferrer" className={`upg-btn ${isFeatured ? 'upg-btn-solid' : 'upg-btn-ghost'}`}>Assinar →</a>
                      : <span className="upg-btn upg-btn-current">Seu plano</span>
                  }
                </div>
              )
            })}
          </div>
        ) : (
          /* Fallback: planos hardcoded do lib/plans.js */
          <div className="upg-grid">
            {hardcodedPlans.map(p => {
              const isCurrent = p.key === currentPlan
              return (
                <div key={p.key} className={`upg-card ${p.key === 'pro' ? 'featured' : ''}`}>
                  {p.key === 'pro' && <span className="upg-popular">Mais popular</span>}
                  <div className="upg-plan-name">{p.label}</div>
                  <div className="upg-price">{p.price ? `R$ ${(p.price/100).toFixed(0)}` : 'Consultar'}</div>
                  <div className="upg-price-sub">{p.price ? '/mês · Google Play' : 'contato direto'}</div>
                  <ul className="upg-feats">{p.features.map(f => <li key={f} className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>{f}</li>)}</ul>
                  {isCurrent
                    ? <span className="upg-btn upg-btn-current">Plano atual</span>
                    : p.price
                      ? <a href={`https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_PACKAGE}`} target="_blank" rel="noreferrer" className={`upg-btn ${p.key==='pro'?'upg-btn-solid':'upg-btn-ghost'}`}>Assinar via Google Play →</a>
                      : <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" className="upg-btn upg-btn-ghost">Falar com vendas</a>
                  }
                </div>
              )
            })}
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
    </AdminLayout>
  )
}
