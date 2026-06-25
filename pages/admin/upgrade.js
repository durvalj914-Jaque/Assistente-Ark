import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS, GOOGLE_PLAY_PACKAGE, isPlanActive } from '../../lib/plans'

export default function Upgrade() {
  const router = useRouter()
  const { user, tenant, loading } = useTenant()
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [token, setToken] = useState({ purchaseToken: '', productId: '', orderId: '' })

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  const currentPlan = PLANS[tenant?.plan] || PLANS.free
  const plans = [
    { key: 'starter', ...PLANS.starter },
    { key: 'pro',     ...PLANS.pro },
    { key: 'enterprise', ...PLANS.enterprise }
  ]

  async function verifyPurchase() {
    setVerifying(true); setVerifyMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/billing/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...token, tenantId: tenant.id })
      })
      const data = await res.json()
      if (res.ok) setVerifyMsg(`✅ Plano ${data.plan} ativado! Recarregue a página.`)
      else setVerifyMsg(`❌ ${data.error || 'Falha na verificação'}`)
    } catch (e) { setVerifyMsg('❌ Erro: ' + e.message) }
    setVerifying(false)
  }

  if (loading) return null

  return (
    <AdminLayout>
      <style>{`
        .upg-title { font-size: 28px; font-weight: 900; color: #fff; letter-spacing: -1px; margin-bottom: 6px; }
        .upg-sub { font-size: 14px; color: rgba(255,255,255,0.35); margin-bottom: 8px; }
        .upg-current { display: inline-flex; align-items: center; gap: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); border-radius: 100px; padding: 5px 14px; font-size: 12px; color: #22c55e; font-weight: 600; margin-bottom: 32px; }
        .upg-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; margin-bottom: 36px; }
        .upg-card { border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 28px 22px; position: relative; }
        .upg-card.featured { border-color: rgba(79,142,247,0.35); background: rgba(79,142,247,0.04); }
        .upg-popular { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg,#4f8ef7,#06b6d4); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 12px; border-radius: 100px; white-space: nowrap; }
        .upg-plan-name { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 8px; }
        .upg-price { font-size: 32px; font-weight: 900; color: #fff; letter-spacing: -1px; margin-bottom: 2px; }
        .upg-price-sub { font-size: 12px; color: rgba(255,255,255,0.25); margin-bottom: 18px; }
        .upg-feats { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
        .upg-feat { font-size: 12px; color: rgba(255,255,255,0.4); display: flex; gap: 8px; }
        .upg-btn { display: block; text-align: center; padding: 11px; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s; }
        .upg-btn-ghost { border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
        .upg-btn-solid { background: linear-gradient(135deg,#4f8ef7,#06b6d4); color: #fff; }
        .upg-btn-current { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); cursor: default; }
        .upg-verify { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 26px 22px; }
        .upg-verify-title { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .upg-verify-sub { font-size: 12px; color: rgba(255,255,255,0.3); margin-bottom: 18px; line-height: 1.6; }
        .upg-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .upg-field label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 5px; }
        .upg-field input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 9px 12px; color: #fff; font-size: 12px; outline: none; font-family: inherit; }
        .upg-field input:focus { border-color: rgba(79,142,247,0.35); }
        .upg-vbtn { padding: 10px 22px; background: #fff; color: #000; border: none; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .upg-vbtn:disabled { opacity: 0.45; cursor: not-allowed; }
        .upg-msg { margin-top: 12px; font-size: 13px; line-height: 1.6; }
        @media(max-width:800px){.upg-grid{grid-template-columns:1fr;}}
      `}</style>

      <h1 className="upg-title">Planos & Pagamento</h1>
      <p className="upg-sub">Escale com seu negócio. Pagamento seguro via Google Play.</p>
      <div className="upg-current">● Plano atual: {currentPlan.label}</div>

      <div className="upg-grid">
        {plans.map(p => (
          <div key={p.key} className={`upg-card ${p.key === 'pro' ? 'featured' : ''}`}>
            {p.key === 'pro' && <span className="upg-popular">Mais popular</span>}
            <div className="upg-plan-name">{p.label}</div>
            <div className="upg-price">{p.price ? `R$\u00a0${(p.price/100).toFixed(0)}` : 'Consultar'}</div>
            <div className="upg-price-sub">{p.price ? '/mês · Google Play' : 'contato direto'}</div>
            <ul className="upg-feats">{p.features.map(f => <li key={f} className="upg-feat"><span style={{color:'#22c55e'}}>✓</span>{f}</li>)}</ul>
            {tenant?.plan === p.key
              ? <span className="upg-btn upg-btn-current">Plano atual</span>
              : p.price
                ? <a href={`https://play.google.com/store/apps/details?id=${GOOGLE_PLAY_PACKAGE}`} target="_blank" rel="noreferrer" className={`upg-btn ${p.key==='pro'?'upg-btn-solid':'upg-btn-ghost'}`}>Assinar via Google Play →</a>
                : <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" className="upg-btn upg-btn-ghost">Falar com vendas</a>
            }
          </div>
        ))}
      </div>

      <div className="upg-verify">
        <div className="upg-verify-title">Já comprou? Ative seu plano agora</div>
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
    </AdminLayout>
  )
}
