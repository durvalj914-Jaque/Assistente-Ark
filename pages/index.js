import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Index() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/admin')
      else setChecking(false)
    })
  }, [])

  if (checking) return <div style={{ background: '#080810', minHeight: '100vh' }} />

  return (
    <div style={{ background: '#080810', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      {/* Background glows */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: 900, height: 500, background: 'radial-gradient(ellipse at top, rgba(79,142,247,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: 600, height: 600, background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Navbar */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(79,142,247,0.1)', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
          <span style={{ fontWeight: 800, fontSize: 16, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Assistente Ark</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" style={{ padding: '8px 18px', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 8, color: '#94a3b8', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s' }}>Entrar</Link>
          <Link href="/login" style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Começar grátis →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '100px 24px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: '#4f8ef7', fontWeight: 600, marginBottom: 28 }}>
          ✨ Plataforma SaaS de Chatbot WhatsApp
        </div>
        <h1 style={{ fontSize: 'clamp(36px,6vw,68px)', fontWeight: 900, lineHeight: 1.08, maxWidth: 800, margin: '0 auto 22px', letterSpacing: '-1.5px' }}>
          Automatize seu{' '}
          <span style={{ background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            WhatsApp
          </span>
          <br />com inteligência
        </h1>
        <p style={{ fontSize: 18, color: '#64748b', maxWidth: 520, margin: '0 auto 44px', lineHeight: 1.7 }}>
          Crie bots poderosos, gerencie conversas e escale seu atendimento sem esforço. Multi-tenant, sem código.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={{ padding: '14px 32px', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 32px rgba(79,142,247,0.3)' }}>
            Criar conta grátis →
          </Link>
          <Link href="/login" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#94a3b8', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            Ver demonstração
          </Link>
        </div>

        {/* Social proof */}
        <div style={{ marginTop: 52, display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {[['🚀','Deploy instantâneo'],['🔒','Dados seguros'],['📊','Analytics real-time'],['🤖','Multi-bot']].map(([icon, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 13 }}>
              <span>{icon}</span><span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard preview */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
          {/* Fake browser bar */}
          <div style={{ background: '#0d0d1a', padding: '12px 20px', borderBottom: '1px solid rgba(79,142,247,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', opacity: 0.7 }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', opacity: 0.7 }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', opacity: 0.7 }} />
            <div style={{ flex: 1, marginLeft: 10, background: '#12121f', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#334155' }}>assistente-ark.vercel.app/admin</div>
          </div>
          {/* Mock dashboard */}
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {[['💬','1.284','Mensagens','#4f8ef7'],['🗂','347','Conversas','#8b5cf6'],['👥','89','Contatos','#10b981'],['🤖','3','Bots ativos','#f59e0b']].map(([icon,val,label,color]) => (
              <div key={label} style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>Conversas recentes</div>
              {[['João Silva','Olá, preciso de ajuda com...','14:32','bot'],['Maria Costa','Quero saber sobre preços','13:15','humano'],['Pedro Alves','Obrigado pelo atendimento!','12:08','fechado']].map(([name,msg,time,status]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{name}</div>
                    <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#334155' }}>{time}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#12121f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>Status do bot</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                <span style={{ fontSize: 12, color: '#10b981' }}>Online</span>
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>Bot Principal</div>
              <div style={{ marginTop: 12, height: 4, background: '#1a1a2e', borderRadius: 4 }}>
                <div style={{ height: '100%', width: '68%', background: 'linear-gradient(90deg,#4f8ef7,#06b6d4)', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>680 / 1.000 mensagens</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.5px' }}>Tudo que você precisa</h2>
          <p style={{ color: '#475569', marginTop: 12, fontSize: 15 }}>Para um atendimento automatizado de verdade</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            ['🤖','Bots Inteligentes','Crie fluxos de conversa visuais sem escrever uma linha de código'],
            ['📊','Analytics Completo','Métricas em tempo real de mensagens, conversas e performance'],
            ['👥','Multi-Tenant','Gerencie múltiplos clientes em uma única plataforma'],
            ['🔒','Segurança RLS','Isolamento total de dados por cliente com Row Level Security'],
            ['⚡','Escalável','De 100 a 1 milhão de mensagens sem mudar nada na arquitetura'],
            ['🎨','White-label','Personalize com a identidade visual do seu negócio'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.1)', borderRadius: 16, padding: 24, transition: 'border-color 0.2s' }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>{title}</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.5px' }}>Planos simples</h2>
          <p style={{ color: '#475569', marginTop: 12, fontSize: 15 }}>Comece grátis, escale quando precisar</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { name: 'Free', price: 'R$ 0', period: '/mês', features: ['1 bot', '1.000 mensagens/mês', 'Analytics básico', 'Suporte por email'], cta: 'Começar grátis', highlight: false },
            { name: 'Pro', price: 'R$ 97', period: '/mês', features: ['5 bots', '50.000 mensagens/mês', 'Analytics avançado', 'Suporte prioritário', 'White-label'], cta: 'Assinar Pro', highlight: true },
            { name: 'Enterprise', price: 'Sob consulta', period: '', features: ['Bots ilimitados', 'Mensagens ilimitadas', 'SLA garantido', 'Onboarding dedicado', 'API customizada'], cta: 'Falar com vendas', highlight: false },
          ].map(plan => (
            <div key={plan.name} style={{
              background: plan.highlight ? 'linear-gradient(135deg,rgba(79,142,247,0.15),rgba(6,182,212,0.1))' : '#0a0a14',
              border: plan.highlight ? '1px solid rgba(79,142,247,0.4)' : '1px solid rgba(79,142,247,0.1)',
              borderRadius: 16, padding: '28px 24px',
              position: 'relative',
              boxShadow: plan.highlight ? '0 0 40px rgba(79,142,247,0.15)' : 'none'
            }}>
              {plan.highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', borderRadius: 20, padding: '3px 14px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>MAIS POPULAR</div>}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>{plan.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 900, color: plan.highlight ? '#4f8ef7' : '#e2e8f0' }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: '#475569' }}>{plan.period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                    <span style={{ color: '#10b981', fontSize: 12 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <Link href="/login" style={{
                display: 'block', textAlign: 'center', padding: '10px',
                background: plan.highlight ? 'linear-gradient(135deg,#4f8ef7,#06b6d4)' : 'rgba(255,255,255,0.05)',
                border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none'
              }}>{plan.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ position: 'relative', zIndex: 1, padding: '0 24px 100px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(79,142,247,0.1),rgba(6,182,212,0.08))', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 20, padding: '56px 40px' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 14, letterSpacing: '-0.5px' }}>Pronto para automatizar?</h2>
          <p style={{ color: '#64748b', fontSize: 15, marginBottom: 32 }}>Crie sua conta grátis em 1 minuto e comece a usar hoje mesmo.</p>
          <Link href="/login" style={{ display: 'inline-block', padding: '14px 36px', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 32px rgba(79,142,247,0.3)' }}>
            Criar conta grátis →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(79,142,247,0.08)', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Assistente Ark</div>
        <div style={{ fontSize: 12, color: '#334155' }}>© 2025 Assistente Ark. Todos os direitos reservados.</div>
      </footer>
    </div>
  )
}
