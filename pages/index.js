import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Head from 'next/head'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/admin')
      else setChecking(false)
    })
  }, [])

  if (checking) return <div style={{ background: '#000', minHeight: '100vh' }} />

  return (
    <>
      <Head>
        <title>Arkiel — Automação Inteligente para WhatsApp Business</title>
        <meta name="description" content="Plataforma SaaS multi-tenant para automação de WhatsApp com IA. Gerencie chatbots, conversas e atendimentos sem código." />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #fff; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }

        .home-root { background: #000; }

        /* Background elements */
        .bg-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .bg-glow-top {
          position: fixed; top: -200px; left: 50%; transform: translateX(-50%);
          width: 1000px; height: 800px; z-index: 0; pointer-events: none;
          background: radial-gradient(ellipse at top, rgba(79,142,247,0.07) 0%, transparent 60%);
        }

        /* HERO */
        .hero {
          position: relative; z-index: 1;
          padding: 160px 80px 120px;
          text-align: center;
          max-width: 1200px; margin: 0 auto;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 100px;
          padding: 6px 16px; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.5); margin-bottom: 32px;
          background: rgba(255,255,255,0.03);
          letter-spacing: 0.3px;
        }
        .hero-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22c55e; box-shadow: 0 0 8px #22c55e;
          animation: blink 2s ease-in-out infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; } 50% { opacity: 0.4; }
        }
        .hero-title {
          font-size: clamp(44px, 7vw, 80px);
          font-weight: 900; line-height: 1.03;
          letter-spacing: -3px; margin-bottom: 28px; color: #fff;
        }
        .hero-title .g {
          background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-title .accent {
          background: linear-gradient(135deg, #4f8ef7, #06b6d4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-sub {
          font-size: 18px; color: rgba(255,255,255,0.38);
          max-width: 540px; margin: 0 auto 48px;
          line-height: 1.75; font-weight: 400;
        }
        .hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .btn-primary {
          padding: 15px 36px; border-radius: 10px;
          background: #fff; color: #000;
          font-size: 15px; font-weight: 700;
          text-decoration: none; transition: all 0.2s;
          letter-spacing: -0.3px;
        }
        .btn-primary:hover { background: rgba(255,255,255,0.88); transform: translateY(-2px); box-shadow: 0 16px 40px rgba(255,255,255,0.15); }
        .btn-ghost {
          padding: 15px 36px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.55); font-size: 15px; font-weight: 500;
          text-decoration: none; transition: all 0.2s;
        }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: #fff; }

        /* HERO STATS */
        .hero-stats {
          display: flex; justify-content: center; gap: 0;
          margin-top: 80px; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; overflow: hidden; max-width: 700px; margin-left: auto; margin-right: auto;
          background: rgba(255,255,255,0.02);
        }
        .hero-stat {
          flex: 1; padding: 28px 20px; text-align: center;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .hero-stat:last-child { border-right: none; }
        .hero-stat-num { font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -1px; }
        .hero-stat-lbl { font-size: 11px; color: rgba(255,255,255,0.3); font-weight: 500; margin-top: 4px; letter-spacing: 0.3px; }

        /* SECTION BASE */
        .section { position: relative; z-index: 1; padding: 100px 80px; max-width: 1200px; margin: 0 auto; }
        .section-tag {
          font-size: 11px; font-weight: 700; letter-spacing: 2px;
          color: #4f8ef7; text-transform: uppercase; margin-bottom: 14px;
        }
        .section-title {
          font-size: clamp(28px, 4vw, 48px); font-weight: 800;
          letter-spacing: -1.5px; color: #fff; line-height: 1.1;
          margin-bottom: 18px;
        }
        .section-sub {
          font-size: 16px; color: rgba(255,255,255,0.35);
          max-width: 520px; line-height: 1.7; margin-bottom: 56px;
        }
        .section-divider {
          height: 1px; background: rgba(255,255,255,0.05);
          margin: 0 80px; position: relative; z-index: 1;
        }

        /* PRODUTOS */
        .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .product-card {
          border: 1px solid rgba(255,255,255,0.07); border-radius: 20px;
          padding: 40px 36px; background: rgba(255,255,255,0.02);
          transition: all 0.25s; cursor: default; position: relative; overflow: hidden;
        }
        .product-card::before {
          content: ''; position: absolute; inset: 0; border-radius: 20px;
          background: linear-gradient(135deg, rgba(79,142,247,0.04), transparent);
          opacity: 0; transition: opacity 0.25s;
        }
        .product-card:hover { border-color: rgba(79,142,247,0.2); transform: translateY(-4px); }
        .product-card:hover::before { opacity: 1; }
        .product-icon {
          width: 52px; height: 52px; border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; margin-bottom: 24px;
          background: rgba(255,255,255,0.03);
        }
        .product-name { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 12px; letter-spacing: -0.5px; }
        .product-desc { font-size: 14px; color: rgba(255,255,255,0.38); line-height: 1.7; margin-bottom: 24px; }
        .product-features { display: flex; flex-direction: column; gap: 10px; }
        .product-feat {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: rgba(255,255,255,0.45);
        }
        .product-feat-dot { width: 5px; height: 5px; border-radius: 50%; background: #4f8ef7; flex-shrink: 0; }
        .product-badge {
          display: inline-block; font-size: 10px; font-weight: 700;
          letter-spacing: 1.5px; text-transform: uppercase;
          padding: 4px 10px; border-radius: 100px;
          border: 1px solid rgba(79,142,247,0.3); color: #4f8ef7;
          margin-bottom: 16px;
        }

        /* SOLUÇÕES */
        .solutions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .solution-card {
          border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
          padding: 32px 28px; background: rgba(255,255,255,0.015);
          transition: all 0.2s;
        }
        .solution-card:hover { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); }
        .solution-icon { font-size: 28px; margin-bottom: 18px; display: block; }
        .solution-name { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 10px; letter-spacing: -0.3px; }
        .solution-desc { font-size: 13px; color: rgba(255,255,255,0.35); line-height: 1.65; }

        /* PREÇOS */
        .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: start; }
        .pricing-card {
          border: 1px solid rgba(255,255,255,0.07); border-radius: 20px;
          padding: 36px 32px; background: rgba(255,255,255,0.02);
          position: relative;
        }
        .pricing-card.featured {
          border-color: rgba(79,142,247,0.35);
          background: rgba(79,142,247,0.04);
        }
        .pricing-popular {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(135deg, #4f8ef7, #06b6d4);
          color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 1.5px;
          text-transform: uppercase; padding: 4px 14px; border-radius: 100px;
          white-space: nowrap;
        }
        .pricing-plan { font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 12px; }
        .pricing-price { font-size: 42px; font-weight: 900; color: #fff; letter-spacing: -2px; margin-bottom: 4px; }
        .pricing-price sup { font-size: 20px; font-weight: 700; vertical-align: top; margin-top: 10px; }
        .pricing-price sub { font-size: 14px; font-weight: 400; color: rgba(255,255,255,0.35); vertical-align: baseline; }
        .pricing-desc { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 28px; line-height: 1.5; }
        .pricing-features { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
        .pricing-feat {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: rgba(255,255,255,0.5);
        }
        .pricing-check { color: #22c55e; font-size: 14px; flex-shrink: 0; }
        .btn-pricing {
          width: 100%; padding: 13px; border-radius: 10px;
          font-size: 14px; font-weight: 700; text-decoration: none;
          display: block; text-align: center; transition: all 0.2s;
        }
        .btn-pricing-ghost {
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.65); background: transparent;
        }
        .btn-pricing-ghost:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .btn-pricing-solid {
          background: linear-gradient(135deg, #4f8ef7, #06b6d4);
          color: #fff; border: none;
          box-shadow: 0 8px 24px rgba(79,142,247,0.3);
        }
        .btn-pricing-solid:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(79,142,247,0.4); }

        /* EMPRESA */
        .empresa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
        .empresa-text .section-title { margin-bottom: 20px; }
        .empresa-body { font-size: 15px; color: rgba(255,255,255,0.4); line-height: 1.8; margin-bottom: 32px; }
        .empresa-contact { display: flex; flex-direction: column; gap: 12px; }
        .empresa-contact-item {
          display: flex; align-items: center; gap: 12px;
          font-size: 13px; color: rgba(255,255,255,0.45);
        }
        .empresa-contact-icon {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; background: rgba(255,255,255,0.02); flex-shrink: 0;
        }
        .empresa-visual {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        .empresa-stat-card {
          border: 1px solid rgba(255,255,255,0.07); border-radius: 16px;
          padding: 28px 24px; background: rgba(255,255,255,0.02);
        }
        .empresa-stat-n { font-size: 32px; font-weight: 900; color: #fff; letter-spacing: -1px; margin-bottom: 6px; }
        .empresa-stat-l { font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.4; }

        /* CTA FINAL */
        .cta-section {
          position: relative; z-index: 1;
          text-align: center; padding: 100px 80px;
          max-width: 800px; margin: 0 auto;
        }
        .cta-title { font-size: clamp(32px, 5vw, 56px); font-weight: 900; letter-spacing: -2px; color: #fff; margin-bottom: 20px; }
        .cta-sub { font-size: 16px; color: rgba(255,255,255,0.35); margin-bottom: 40px; line-height: 1.7; }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .hero { padding: 120px 24px 80px; }
          .section { padding: 70px 24px; }
          .section-divider { margin: 0 24px; }
          .products-grid { grid-template-columns: 1fr; }
          .solutions-grid { grid-template-columns: 1fr 1fr; }
          .pricing-grid { grid-template-columns: 1fr; }
          .empresa-grid { grid-template-columns: 1fr; }
          .cta-section { padding: 70px 24px; }
          .hero-stats { flex-direction: column; border-radius: 12px; }
          .hero-stat { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .hero-stat:last-child { border-bottom: none; }
        }
        @media (max-width: 600px) {
          .solutions-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="home-root">
        <div className="bg-grid" />
        <div className="bg-glow-top" />

        <Navbar />

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Plataforma ativa · Novo: Ark AOI disponível
          </div>
          <h1 className="hero-title">
            <span className="g">Automatize seu</span><br />
            <span className="accent">atendimento</span><br />
            <span className="g">com IA.</span>
          </h1>
          <p className="hero-sub">
            Gerencie chatbots de WhatsApp, conversas e equipes em uma plataforma unificada. Multi-tenant, escalável e sem código.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="btn-primary">Começar gratuitamente →</Link>
            <Link href="#produtos" className="btn-ghost">Ver produtos</Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-num">10k+</div>
              <div className="hero-stat-lbl">Mensagens / dia</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">99.9%</div>
              <div className="hero-stat-lbl">Uptime garantido</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">&lt; 1s</div>
              <div className="hero-stat-lbl">Tempo de resposta</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">Multi</div>
              <div className="hero-stat-lbl">Tenant isolado</div>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── PRODUTOS ── */}
        <section className="section" id="produtos">
          <div className="section-tag">Produtos</div>
          <h2 className="section-title">Uma plataforma,<br />dois produtos.</h2>
          <p className="section-sub">Soluções complementares para automação completa do seu atendimento digital.</p>
          <div className="products-grid">
            <div className="product-card">
              <div className="product-badge">Principal</div>
              <div className="product-icon">💬</div>
              <div className="product-name">Assistente Ark</div>
              <p className="product-desc">Plataforma completa para criação e gestão de chatbots WhatsApp Business com painel administrativo multi-tenant, editor visual de fluxos e analytics em tempo real.</p>
              <div className="product-features">
                <div className="product-feat"><span className="product-feat-dot" />Editor de fluxos sem código</div>
                <div className="product-feat"><span className="product-feat-dot" />Painel multi-tenant com isolamento</div>
                <div className="product-feat"><span className="product-feat-dot" />Histórico completo de conversas</div>
                <div className="product-feat"><span className="product-feat-dot" />Gestão de contatos e tags</div>
                <div className="product-feat"><span className="product-feat-dot" />Relatórios e analytics avançados</div>
              </div>
            </div>
            <div className="product-card">
              <div className="product-badge" style={{ borderColor: 'rgba(139,92,246,0.3)', color: '#8b5cf6' }}>Em breve</div>
              <div className="product-icon">🧠</div>
              <div className="product-name">Ark AOI</div>
              <p className="product-desc">Agente Operacional Inteligente — IA autônoma que aprende com seus dados, responde com contexto e age proativamente para resolver demandas complexas sem intervenção humana.</p>
              <div className="product-features">
                <div className="product-feat"><span className="product-feat-dot" style={{ background: '#8b5cf6' }} />IA com memória de contexto longa</div>
                <div className="product-feat"><span className="product-feat-dot" style={{ background: '#8b5cf6' }} />Integração com CRM e ERP</div>
                <div className="product-feat"><span className="product-feat-dot" style={{ background: '#8b5cf6' }} />Aprendizado contínuo</div>
                <div className="product-feat"><span className="product-feat-dot" style={{ background: '#8b5cf6' }} />Ações autônomas e agendadas</div>
                <div className="product-feat"><span className="product-feat-dot" style={{ background: '#8b5cf6' }} />Escalonamento humano inteligente</div>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── SOLUÇÕES ── */}
        <section className="section" id="solucoes">
          <div className="section-tag">Soluções</div>
          <h2 className="section-title">Tudo que você precisa<br />em um só lugar.</h2>
          <p className="section-sub">Ferramentas poderosas para automação, análise e gestão de atendimento.</p>
          <div className="solutions-grid">
            {[
              { icon: '⚡', name: 'Automação de Fluxos', desc: 'Crie fluxos de conversa visuais com condições, ramificações e ações automatizadas — sem uma linha de código.' },
              { icon: '📊', name: 'Analytics em Tempo Real', desc: 'Dashboards completos com métricas de atendimento, taxa de resposta, conversões e performance dos agentes.' },
              { icon: '👥', name: 'Gestão Multi-Tenant', desc: 'Isole dados por empresa com arquitetura multi-tenant robusta. Cada cliente tem seu ambiente seguro e independente.' },
              { icon: '🔗', name: 'Integrações Nativas', desc: 'Conecte com CRM, ERP, plataformas de pagamento e qualquer API via webhooks configuráveis.' },
              { icon: '🛡️', name: 'Segurança Enterprise', desc: 'Autenticação OAuth, criptografia de dados, backups automáticos e conformidade com LGPD.' },
              { icon: '📱', name: 'WhatsApp Business API', desc: 'Integração oficial com a API do WhatsApp Business para alto volume de mensagens sem restrições.' },
            ].map(s => (
              <div key={s.name} className="solution-card">
                <span className="solution-icon">{s.icon}</span>
                <div className="solution-name">{s.name}</div>
                <p className="solution-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider" />

        {/* ── PREÇOS ── */}
        <section className="section" id="precos">
          <div className="section-tag">Preços</div>
          <h2 className="section-title">Planos para todos<br />os tamanhos.</h2>
          <p className="section-sub">Comece gratuitamente e escale conforme seu negócio cresce.</p>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-plan">Starter</div>
              <div className="pricing-price"><sup>R$</sup>0<sub>/mês</sub></div>
              <p className="pricing-desc">Ideal para testar e validar sua operação.</p>
              <div className="pricing-features">
                {['1 chatbot ativo', '500 mensagens/mês', 'Painel básico', 'Suporte por e-mail'].map(f => (
                  <div key={f} className="pricing-feat"><span className="pricing-check">✓</span>{f}</div>
                ))}
              </div>
              <Link href="/login" className="btn-pricing btn-pricing-ghost">Começar grátis</Link>
            </div>
            <div className="pricing-card featured">
              <span className="pricing-popular">Mais popular</span>
              <div className="pricing-plan">Pro</div>
              <div className="pricing-price"><sup>R$</sup>297<sub>/mês</sub></div>
              <p className="pricing-desc">Para negócios que querem escalar o atendimento.</p>
              <div className="pricing-features">
                {['Chatbots ilimitados', '10.000 mensagens/mês', 'Analytics avançado', 'Editor visual de fluxos', 'Integrações via webhook', 'Suporte prioritário'].map(f => (
                  <div key={f} className="pricing-feat"><span className="pricing-check">✓</span>{f}</div>
                ))}
              </div>
              <Link href="/login" className="btn-pricing btn-pricing-solid">Assinar Pro →</Link>
            </div>
            <div className="pricing-card">
              <div className="pricing-plan">Enterprise</div>
              <div className="pricing-price" style={{ fontSize: 32 }}>Sob consulta</div>
              <p className="pricing-desc">Para operações de grande escala e necessidades específicas.</p>
              <div className="pricing-features">
                {['Mensagens ilimitadas', 'SLA garantido 99.9%', 'Ark AOI incluso', 'Onboarding dedicado', 'Gerente de conta', 'Conformidade LGPD'].map(f => (
                  <div key={f} className="pricing-feat"><span className="pricing-check">✓</span>{f}</div>
                ))}
              </div>
              <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" className="btn-pricing btn-pricing-ghost">Falar com vendas</a>
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── EMPRESA ── */}
        <section className="section" id="empresa">
          <div className="empresa-grid">
            <div className="empresa-text">
              <div className="section-tag">Empresa</div>
              <h2 className="section-title">Tecnologia brasileira<br />de alta performance.</h2>
              <p className="empresa-body">
                A Arkiel nasceu com a missão de democratizar a automação inteligente para empresas brasileiras. Desenvolvemos soluções SaaS de alto desempenho que transformam o atendimento ao cliente em vantagem competitiva.<br /><br />
                Nossa equipe combina expertise em inteligência artificial, desenvolvimento de software e experiência do usuário para entregar produtos que realmente funcionam.
              </p>
              <div className="empresa-contact">
                <div className="empresa-contact-item">
                  <div className="empresa-contact-icon">✉️</div>
                  <a href="mailto:arkieltech@gmail.com" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>arkieltech@gmail.com</a>
                </div>
                <div className="empresa-contact-item">
                  <div className="empresa-contact-icon">📱</div>
                  <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>+55 11 91375-1590</a>
                </div>
                <div className="empresa-contact-item">
                  <div className="empresa-contact-icon">📍</div>
                  <span>São Paulo, Brasil</span>
                </div>
              </div>
            </div>
            <div className="empresa-visual">
              {[
                { n: '10k+', l: 'Mensagens processadas por dia' },
                { n: '99.9%', l: 'Uptime da plataforma' },
                { n: '2024', l: 'Fundação da empresa' },
                { n: '24/7', l: 'Monitoramento ativo' },
              ].map(s => (
                <div key={s.n} className="empresa-stat-card">
                  <div className="empresa-stat-n">{s.n}</div>
                  <div className="empresa-stat-l">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="section-divider" />

        {/* ── CTA FINAL ── */}
        <section className="cta-section">
          <h2 className="cta-title">Pronto para transformar seu atendimento?</h2>
          <p className="cta-sub">Junte-se a empresas que já automatizaram seu WhatsApp com a Arkiel. Comece gratuitamente, sem cartão de crédito.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-primary">Criar conta grátis →</Link>
            <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" className="btn-ghost">Falar com especialista</a>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
