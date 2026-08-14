import { useState, useEffect } from 'react'
import Link from 'next/link'
import Head from 'next/head'

export default function Home() {
  const [activeSection, setActiveSection] = useState('inicio')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40)
      const sections = ['inicio', 'produtos', 'solucoes', 'sobre', 'contato']
      for (const s of sections) {
        const el = document.getElementById(s)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 120 && rect.bottom >= 120) { setActiveSection(s); break }
        }
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navTabs = [
    { id: 'inicio', label: 'Início' },
    { id: 'produtos', label: 'Produtos' },
    { id: 'solucoes', label: 'Soluções' },
    { id: 'sobre', label: 'Sobre' },
    { id: 'contato', label: 'Contato' },
  ]

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Head>
        <title>Arkiel — Tecnologia Inteligente para o Seu Negócio</title>
        <meta name="description" content="Arkiel é uma empresa de tecnologia que desenvolve soluções de automação, IA e inspeção óptica para WhatsApp Business e indústria 4.0." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #08080a; color: #fff; -webkit-font-smoothing: antialiased; }

        /* ===== NAVBAR ===== */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 300;
          height: 72px; display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; transition: all .3s;
          background: transparent; border-bottom: 1px solid transparent;
        }
        .nav.scrolled {
          background: rgba(8,8,10,0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .nav-logo { display: flex; align-items: center; cursor: pointer; }
        .nav-logo img { height: 40px; width: auto; object-fit: contain; }

        .nav-tabs { display: flex; gap: 2px; list-style: none; }
        .nav-tab {
          padding: 8px 18px; border-radius: 10px; font-size: 14px; font-weight: 500;
          color: rgba(255,255,255,0.45); cursor: pointer; transition: all .2s;
          background: transparent; border: none; text-decoration: none;
        }
        .nav-tab:hover { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.04); }
        .nav-tab.active { color: #25D366; background: rgba(37,211,102,0.08); }

        @media (max-width: 900px) {
          .nav { padding: 0 16px; }
          .nav-tabs { display: none; }
        }

        /* ===== HERO ===== */
        .hero {
          min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 120px 24px 80px; text-align: center; position: relative; overflow: hidden;
        }
        .hero::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,211,102,0.15), transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(0,212,255,0.08), transparent 70%);
        }
        .hero::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .4;
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 100px;
          background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.2); color: #25D366;
          font-size: 13px; font-weight: 600; margin-bottom: 32px; position: relative;
        }
        .hero-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: #25D366; box-shadow: 0 0 10px #25D366; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

        .hero h1 {
          font-size: clamp(44px, 7vw, 88px); font-weight: 800; letter-spacing: -3px; line-height: 1.02;
          max-width: 880px; margin-bottom: 28px; position: relative;
        }
        .hero h1 .grad { background: linear-gradient(135deg, #25D366 0%, #00d4ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero p {
          font-size: clamp(16px, 2vw, 21px); color: rgba(255,255,255,0.5); max-width: 620px;
          line-height: 1.6; margin-bottom: 48px; position: relative;
        }

        .hero-stats { display: flex; gap: 48px; flex-wrap: wrap; justify-content: center; position: relative; }
        .hero-stat { text-align: center; }
        .hero-stat .num { font-size: 36px; font-weight: 800; background: linear-gradient(135deg, #25D366, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-stat .label { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 4px; }

        /* ===== SECTIONS ===== */
        .section { padding: 120px 24px; max-width: 1200px; margin: 0 auto; }
        .section-header { text-align: center; margin-bottom: 64px; }
        .section-tag {
          display: inline-block; font-size: 13px; font-weight: 700; color: #25D366;
          letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;
        }
        .section-title { font-size: clamp(30px, 4.5vw, 48px); font-weight: 800; letter-spacing: -1.5px; margin-bottom: 16px; }
        .section-desc { font-size: 17px; color: rgba(255,255,255,0.4); max-width: 580px; margin: 0 auto; line-height: 1.6; }

        /* ===== PRODUTOS ===== */
        .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 28px; }
        .product-card {
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px;
          padding: 48px 40px; transition: all .25s; display: flex; flex-direction: column; position: relative; overflow: hidden;
        }
        .product-card:hover { border-color: rgba(37,211,102,0.25); transform: translateY(-6px); background: rgba(255,255,255,0.035); }
        .product-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(37,211,102,0.4), transparent);
          opacity: 0; transition: opacity .25s;
        }
        .product-card:hover::before { opacity: 1; }
        .product-icon { width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 30px; margin-bottom: 28px; }
        .product-icon.green { background: rgba(37,211,102,0.1); box-shadow: 0 0 24px rgba(37,211,102,0.1); }
        .product-icon.cyan { background: rgba(0,212,255,0.1); box-shadow: 0 0 24px rgba(0,212,255,0.1); }
        .product-icon.mascot { width: 76px; height: 76px; background: transparent; box-shadow: 0 0 30px rgba(37,211,102,0.2); border-radius: 20px; overflow: hidden; }
        .product-icon.mascot.cyan-glow { box-shadow: 0 0 30px rgba(0,212,255,0.2); }
        .product-icon.mascot img { width: 100%; height: 100%; object-fit: contain; }
        .product-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: auto; flex-wrap: wrap; }
        .product-cta {
          display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 100px;
          background: linear-gradient(135deg, #25D366, #1eb857); color: #06140a; font-size: 14px; font-weight: 700;
          text-decoration: none; transition: all .2s; box-shadow: 0 4px 20px rgba(37,211,102,0.25);
        }
        .product-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 26px rgba(37,211,102,0.4); }
        .product-card h3 { font-size: 26px; font-weight: 700; margin-bottom: 14px; }
        .product-card p { color: rgba(255,255,255,0.45); font-size: 15px; line-height: 1.65; margin-bottom: 24px; }
        .product-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .product-tag { padding: 5px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; background: rgba(37,211,102,0.08); color: #25D366; border: 1px solid rgba(37,211,102,0.15); }
        .product-tag.cyan { background: rgba(0,212,255,0.08); color: #00d4ff; border-color: rgba(0,212,255,0.15); }
        .product-status { margin-top: auto; font-size: 14px; font-weight: 600; color: #25D366; display: flex; align-items: center; gap: 8px; }
        .product-status.soon { color: rgba(255,255,255,0.25); }
        .product-status .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

        /* ===== SOLUÇÕES ===== */
        .solucoes { background: rgba(255,255,255,0.015); border-top: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px; max-width: 1200px; margin: 0 auto; }
        .feature-card {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 18px;
          padding: 36px 30px; transition: all .2s;
        }
        .feature-card:hover { border-color: rgba(37,211,102,0.2); background: rgba(37,211,102,0.02); }
        .feature-num { font-size: 14px; font-weight: 700; color: rgba(37,211,102,0.5); letter-spacing: 2px; margin-bottom: 16px; }
        .feature-card h4 { font-size: 19px; font-weight: 700; margin-bottom: 10px; }
        .feature-card p { color: rgba(255,255,255,0.4); font-size: 15px; line-height: 1.6; }

        /* ===== SOBRE ===== */
        .sobre-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
        @media (max-width: 768px) { .sobre-grid { grid-template-columns: 1fr; gap: 40px; } }
        .sobre-text h2 { font-size: clamp(28px, 4vw, 42px); font-weight: 800; letter-spacing: -1px; margin-bottom: 24px; }
        .sobre-text p { color: rgba(255,255,255,0.45); font-size: 16px; line-height: 1.8; margin-bottom: 20px; }
        .sobre-values { display: flex; flex-direction: column; gap: 20px; }
        .sobre-value { display: flex; gap: 16px; align-items: flex-start; }
        .sobre-value .icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(37,211,102,0.08); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .sobre-value h5 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .sobre-value p { font-size: 14px; color: rgba(255,255,255,0.35); margin: 0; line-height: 1.5; }

        /* ===== CONTATO ===== */
        .contato { text-align: center; }
        .contato h2 { font-size: clamp(32px, 5vw, 52px); font-weight: 800; letter-spacing: -1.5px; margin-bottom: 20px; }
        .contato p { color: rgba(255,255,255,0.45); font-size: 18px; margin-bottom: 48px; }
        .contato-cards { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .contato-card {
          background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
          padding: 32px 40px; display: flex; flex-direction: column; align-items: center; gap: 12px;
          text-decoration: none; color: inherit; transition: all .2s; min-width: 200px;
        }
        .contato-card:hover { border-color: rgba(37,211,102,0.25); transform: translateY(-4px); }
        .contato-card .icon { font-size: 28px; }
        .contato-card .label { font-size: 13px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1px; }
        .contato-card .value { font-size: 16px; font-weight: 600; color: #fff; }

        /* ===== FOOTER ===== */
        .footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 56px 24px 32px; }
        .footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 32px; }
        .footer-brand { display: flex; flex-direction: column; gap: 14px; }
        .footer-brand .logo { display: flex; align-items: center; }
        .footer-brand .logo img { height: 34px; width: auto; }
        .footer-brand p { font-size: 13px; color: rgba(255,255,255,0.3); max-width: 280px; line-height: 1.5; }
        .footer-links { display: flex; gap: 48px; flex-wrap: wrap; }
        .footer-col h6 { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 14px; }
        .footer-col a { display: block; font-size: 14px; color: rgba(255,255,255,0.3); text-decoration: none; margin-bottom: 8px; transition: color .15s; }
        .footer-col a:hover { color: #fff; }
        .footer-bottom { max-width: 1200px; margin: 48px auto 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.04); text-align: center; }
        .footer-bottom p { font-size: 12px; color: rgba(255,255,255,0.2); }
      `}</style>

      {/* NAVBAR */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo" onClick={() => scrollTo('inicio')}>
          <img src="/arkiel-logo.png" alt="Arkiel" />
        </div>
        <div className="nav-tabs">
          {navTabs.map(t => (
            <button key={t.id} className={`nav-tab ${activeSection === t.id ? 'active' : ''}`} onClick={() => scrollTo(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* HERO / INÍCIO */}
      <section className="hero" id="inicio">
        <div className="hero-badge">
          <span className="dot"></span>
          Tecnologia que trabalha por você
        </div>
        <h1>Automação <span className="grad">inteligente</span> para o seu negócio</h1>
        <p>A Arkiel desenvolve soluções de inteligência artificial e automação que reduzem custos, aumentam vendas e transformam a relação entre empresas e clientes.</p>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="num">2</div>
            <div className="label">Produtos</div>
          </div>
          <div className="hero-stat">
            <div className="num">100%</div>
            <div className="label">Automático</div>
          </div>
          <div className="hero-stat">
            <div className="num">24/7</div>
            <div className="label">Disponibilidade</div>
          </div>
        </div>
      </section>

      {/* PRODUTOS */}
      <section className="section" id="produtos">
        <div className="section-header">
          <div className="section-tag">Nossos Produtos</div>
          <h2 className="section-title">Soluções que entregam resultado</h2>
          <p className="section-desc">Produtos pensados para resolver problemas reais com tecnologia de ponta.</p>
        </div>
        <div className="product-grid">
          <div className="product-card">
            <div className="product-icon mascot"><img src="/assistente-ark-mascot.png" alt="Assistente Ark" /></div>
            <h3>Assistente Ark</h3>
            <p>Plataforma SaaS multi-tenant para automação de WhatsApp Business com IA. Crie chatbots sem código, gerencie catálogo de produtos, processe pagamentos e atenda clientes 24/7.</p>
            <div className="product-tags">
              <span className="product-tag">WhatsApp Business</span>
              <span className="product-tag">SaaS</span>
              <span className="product-tag">IA</span>
              <span className="product-tag">Pagamentos</span>
            </div>
            <div className="product-card-footer">
              <div className="product-status">
                <span className="dot"></span>
                Disponível
              </div>
              <Link href="/assistente-ark" className="product-cta">Conhecer o Ark →</Link>
            </div>
          </div>
          <div className="product-card">
            <div className="product-icon mascot cyan-glow"><img src="/azura-icon.png" alt="Azura" /></div>
            <h3>Azura</h3>
            <p>Agente autônomo para smartphones Android. Executa tarefas, automatiza ações e toma decisões no seu dispositivo sem intervenção manual — sua IA pessoal rodando direto no bolso.</p>
            <div className="product-tags">
              <span className="product-tag cyan">Agente Autônomo</span>
              <span className="product-tag cyan">Android</span>
              <span className="product-tag cyan">IA</span>
            </div>
            <div className="product-status soon">
              <span className="dot"></span>
              Em desenvolvimento
            </div>
          </div>
        </div>
      </section>

      {/* SOLUÇÕES */}
      <section className="solucoes" id="solucoes">
        <div className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="section-header">
            <div className="section-tag">Soluções</div>
            <h2 className="section-title">Tecnologia que simplifica</h2>
            <p className="section-desc">Recursos que fazem a diferença no dia a dia do seu negócio.</p>
          </div>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-num">01</div>
              <h4>Automação real</h4>
              <p>Bots que atendem, vendem e gerenciam pedidos sem intervenção humana. Seu time foca no que importa.</p>
            </div>
            <div className="feature-card">
              <div className="feature-num">02</div>
              <h4>Inteligência Artificial</h4>
              <p>Respostas inteligentes baseadas em contexto. Geração de fluxos conversacionais com IA integrada.</p>
            </div>
            <div className="feature-card">
              <div className="feature-num">03</div>
              <h4>Pagamentos integrados</h4>
              <p>PIX dinâmico e checkout Mercado Pago direto no WhatsApp. Split automático de taxas e comprovantes.</p>
            </div>
            <div className="feature-card">
              <div className="feature-num">04</div>
              <h4>Catálogo nativo</h4>
              <p>Sincronização com o catálogo oficial do WhatsApp. Produtos, preços e pedidos integrados em um só lugar.</p>
            </div>
            <div className="feature-card">
              <div className="feature-num">05</div>
              <h4>Multi-tenant</h4>
              <p>Cada cliente tem seu próprio bot, número e dados isolados. Gerencie tudo de um painel central.</p>
            </div>
            <div className="feature-card">
              <div className="feature-num">06</div>
              <h4>Conexão por SMS</h4>
              <p>Ative números sem precisar de conta no Facebook. Cadastre o telefone e receba o código por SMS.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section className="section" id="sobre">
        <div className="section-header">
          <div className="section-tag">Sobre a Arkiel</div>
          <h2 className="section-title">Quem somos</h2>
        </div>
        <div className="sobre-grid">
          <div className="sobre-text">
            <p>A Arkiel é uma empresa de tecnologia focada em criar soluções inteligentes que automatizam processos e conectam empresas aos seus clientes de forma eficiente.</p>
            <p>Nascemos da visão de que automação não precisa ser complexa. Com produtos que combinam inteligência artificial, visão computacional e plataformas SaaS, entregamos ferramentas que funcionam — e que qualquer pessoa pode usar.</p>
            <p>Do atendimento no WhatsApp à inspeção óptica na indústria, desenvolvemos tecnologia que trabalha por você.</p>
          </div>
          <div className="sobre-values">
            <div className="sobre-value">
              <div className="icon">🎯</div>
              <div>
                <h5>Foco no resultado</h5>
                <p>Tecnologia que resolve problemas reais, não que impressiona em demos.</p>
              </div>
            </div>
            <div className="sobre-value">
              <div className="icon">⚡</div>
              <div>
                <h5>Velocidade</h5>
                <p>Da ideia à produção em tempo recorde. Iteramos rápido e entregamos mais rápido.</p>
              </div>
            </div>
            <div className="sobre-value">
              <div className="icon">🔒</div>
              <div>
                <h5>Segurança</h5>
                <p>Dados protegidos, arquitetura isolada por tenant e autenticação via Google OAuth.</p>
              </div>
            </div>
            <div className="sobre-value">
              <div className="icon">🤝</div>
              <div>
                <h5>Parceria</h5>
                <p>Crescemos junto com nossos clientes. O sucesso deles é a nossa métrica.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTATO */}
      <section className="section contato" id="contato">
        <h2>Vamos conversar</h2>
        <p>Entre em contato e descubra como a Arkiel pode transformar o seu negócio.</p>
        <div className="contato-cards">
          <a href="https://wa.me/5511913751590" target="_blank" rel="noopener" className="contato-card">
            <div className="icon">💬</div>
            <div className="label">WhatsApp</div>
            <div className="value">+55 11 91375-1590</div>
          </a>
          <a href="mailto:arkieltech@gmail.com" className="contato-card">
            <div className="icon">✉️</div>
            <div className="label">E-mail</div>
            <div className="value">arkieltech@gmail.com</div>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="logo">
              <img src="/arkiel-logo.png" alt="Arkiel" />
            </div>
            <p>Tecnologia inteligente para automação e inteligência artificial. Do WhatsApp à indústria.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h6>Produtos</h6>
              <Link href="/assistente-ark">Assistente Ark</Link>
              <a href="/#produtos">Ark AOI</a>
            </div>
            <div className="footer-col">
              <h6>Empresa</h6>
              <a href="/#sobre">Sobre</a>
              <a href="/#contato">Contato</a>
            </div>
            <div className="footer-col">
              <h6>Legal</h6>
              <Link href="/termos">Termos de Uso</Link>
              <Link href="/privacidade">Privacidade</Link>
            </div>
            <div className="footer-col">
              <h6>Acesso</h6>
              <Link href="/assistente-ark/entrar">Painel</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Arkiel Tecnologia. Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  )
}
