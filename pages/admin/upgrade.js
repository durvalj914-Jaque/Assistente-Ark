import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { PLANS } from '../../lib/plans'

export default function UpgradePage() {
  const { user, tenant, role, loading } = useTenant()
  const router = useRouter()

  if (loading || !user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22, marginBottom: 8, textAlign: 'center' }}>⚡ Escolha seu plano</h1>
        <p style={{ color: '#475569', textAlign: 'center', marginBottom: 40 }}>Escale seu atendimento com o Assistente Ark</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {Object.entries(PLANS).map(([key, plan]) => {
            const isCurrent = tenant.plan === key
            const isPro = key === 'pro'
            return (
              <div key={key} className="ark-card" style={{
                border: isPro ? '2px solid #4f8ef7' : '1px solid rgba(79,142,247,0.12)',
                position: 'relative',
                transform: isPro ? 'scale(1.03)' : 'scale(1)',
                background: isPro ? 'linear-gradient(135deg, rgba(79,142,247,0.05), rgba(6,182,212,0.03))' : '#0a0a14'
              }}>
                {isPro && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', borderRadius: 20, padding: '3px 16px', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                    MAIS POPULAR
                  </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{plan.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#4f8ef7' }}>
                    {plan.price === null ? 'Sob consulta' : plan.price === 0 ? 'Grátis' : `R$ ${plan.price}`}
                  </div>
                  {plan.price > 0 && <div style={{ color: '#475569', fontSize: 12 }}>/mês</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                      <span style={{ color: '#10b981', flexShrink: 0 }}>✓</span>
                      <span style={{ color: '#94a3b8' }}>{f}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: 8, color: '#10b981', fontSize: 13, fontWeight: 600 }}>
                    ✅ Plano atual
                  </div>
                ) : key === 'enterprise' ? (
                  <a href="https://wa.me/5511913751590?text=Olá! Tenho interesse no plano Enterprise do Assistente Ark."
                    target="_blank" className="ark-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                    Falar com vendas
                  </a>
                ) : (
                  <button className="ark-btn" style={{ width: '100%' }}
                    onClick={() => alert('Integração com Stripe em breve!')}>
                    Assinar {plan.label}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
