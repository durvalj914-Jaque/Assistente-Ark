import Link from 'next/link'
import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Arkiel — Tecnologia Inteligente para o Seu Negócio</title>
        <meta name="description" content="Arkiel é uma empresa de tecnologia que cria soluções de automação e IA para WhatsApp Business. Conheça o Assistente Ark e o Ark AOI." />
        <link rel="icon" href="/logo-arkiel.png" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; }

        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          background: rgba(10,10,10,0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06); height: 68px;
          display: flex; align-items: center; padding: 0 40px; justify-content: space-between;
        }
        .nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .nav-logo img { width: 36px; height: 36px; object-fit: contain; }
        .nav-logo span { font-size: 15px; font-weight: 800; letter-spacing: 4px; color: #fff; text-transform: uppercase; }
        .nav-links { display: flex; align-items: center; gap: 4px; list-style: none; }
        .nav-links a { padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.55); text-decoration: none; transition: all .15s; }
        .nav-links a:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .nav-cta { display: flex; align-items: center; gap: 10px; }
        .btn-ghost { padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.65); font-size: 13px; font-weight: 500; text-decoration: none; transition: all .15s; background: transparent; }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .btn-primary { padding: 8px 20px; border-radius: 8px; background: #25D366; color: #0a0a0a; font-size: 13px; font-weight: 700; text-decoration: none; transition: all .15s; }
        .btn-primary:hover { background: #1fb855; transform: translateY(-1px); }

        .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 24px 80px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(37,211,102,0.12), transparent 60%); pointer-events: none; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 100px; background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.2); color: #25D366; font-size: 12px; font-weight: 600; margin-bottom: 28px; }
        .hero h1 { font-size: clamp(40px, 6vw, 76px); font-weight: 800; letter-spacing: -2px; line-height: 1.05; max-width: 820px; margin-bottom: 24px; }
        .hero h1 span { background: linear-gradient(135deg, #25D366, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero p { font-size: clamp(16px, 2vw, 20px); color: rgba(255,255,255,0.55); max-width: 580px; line-height: 1.6; margin-bottom: 40px; }
        .hero-cta { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .btn-hero-primary { padding: 14px 32px; border-radius: 12px; background: #25D366; color: #0a0a0a; font-size: 15px; font-weight: 700; text-decoration: none; transition: all .2s; }
        .btn-hero-primary:hover { background: #1fb855; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(37,211,102,0.3); }
        .btn-hero-ghost { padding: 14px 32px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 15px; font-weight: 500; text-decoration: none; transition: all .2s; background: transparent; }
        .btn-hero-ghost:hover { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); }

        .products { padding: 100px 24px; max-width: 1100px; margin: 0 auto; }
        .section-title { font-size: 14px; font-weight: 700; color: #25D366; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; text-align: center; }
        .section-sub { font-size: clamp(28px, 4vw, 44px); font-weight: 800; text-align: center; margin-bottom: 56px; letter-spacing: -1px; }
        .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
        .product-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 40px 32px; transition: all .2s; text-decoration: none; color: inherit; display: flex; flex-direction: column; }
        .product-card:hover { border-color: rgba(37,211,102,0.3); background: rgba(37,211,102,0.04); transform: translateY(-4px); }
        .product-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 24px; }
        .product-icon.green { background: rgba(37,211,102,0.12); }
        .product-icon.blue { background: rgba(0,212,255,0.12); }
        .product-card h3 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
        .product-card p { color: rgba(255,255,255,0.5); font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
        .product-card .tag { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 600; background: rgba(37,211,102,0.1); color: #25D366; border: 1px solid rgba(37,211,102,0.15); }
        .product-link { color: #25D366; font-size: 14px; font-weight: 600; text-decoration: none; margin-top: auto; display: inline-flex; align-items: center; gap: 6px; }
        .product-link:hover { gap: 10px; transition: gap .15s; }

        .features { padding: 100px 24px; background: rgba(255,255,255,0.02); }
        .features-inner { max-width: 1100px; margin: 0 auto; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 32px; }
        .feature { text-align: left; }
        .feature-num { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #25D366, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; }
        .feature h4 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
        .feature p { color: rgba(255,255,255,0.45); font-size: 14px; line-height: 1.6; }

        .cta-section { padding: 120px 24px; text-align: center; }
        .cta-section h2 { font-size: clamp(32px, 5vw, 52px); font-weight: 800; letter-spacing: -1px; margin-bottom: 20px; }
        .cta-section p { color: rgba(255,255,255,0.5); font-size: 18px; margin-bottom: 36px; }

        .footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 48px 24px; text-align: center; }
        .footer-logo { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
        .footer-logo img { width: 28px; height: 28px; }
        .footer-logo span { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #fff; text-transform: uppercase; }
        .footer-links { display: flex; justify-content: center; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
        .footer-links a { color: rgba(255,255,255,0.4); font-size: 13px; text-decoration: none; transition: color .15s; }
        .footer-links a:hover { color: #fff; }
        .footer-copy { color: rgba(255,255,255,0.25); font-size: 12px; }

        @media (max-width: 768px) {
          .nav { padding: 0 16px; }
          .nav-links { display: none; }
          .hero { padding: 80px 20px 60px; }
          .products, .features { padding: 60px 20px; }
        }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <img src="/logo-arkiel.png" alt="Arkiel" />
          <span>ARKIEL</span>
        </Link>
        <ul className="nav-links">
          <li><a href="#produtos">Produtos</a></li>
          <li><a href="#solucoes">Soluções</a></li>
          <li><a href="#contato">Contato</a></li>
        </ul>
        <div className="nav-cta">
          <Link href="/assistente-ark" className="btn-ghost">Entrar</Link>
          <Link href="/assistente-ark" className="btn-primary">Começar agora</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">🟢 Tecnologia que trabalha por você</div>
        <h1>Automação <span>inteligente</span> para o seu negócio</h1>
        <p>A Arkiel desenvolve soluções de IA e automação para WhatsApp Business que reduzem custos, aumentam vendas e melhoram o atendimento dos seus clientes.</p>
        <div className="hero-cta">
          <Link href="/assistente-ark" className="btn-hero-primary">Conhecer o Assistente Ark</Link>
          <a href="#produtos" className="btn-hero-ghost">Ver produtos</a>
        </div>
      </section>

      <section className="products" id="produtos">
        <div className="section-title">Nossos produtos</div>
        <h2 className="section-sub">Soluções que entregam resultado</h2>
        <div className="product-grid">
          <Link href="/assistente-ark" className="product-card">
            <div className="product-icon green">💬</div>
            <h3>Assistente Ark</h3>
            <p>Plataforma SaaS para criar e gerenciar chatbots de WhatsApp com IA, catálogo de produtos, pagamentos integrados e painel administrativo completo.</p>
            <span className="tag">WhatsApp Business</span>
            <span className="product-link">Acessar plataforma →</span>
          </Link>
          <div className="product-card">
            <div className="product-icon blue">🔍</div>
            <h3>Ark AOI</h3>
            <p>Solução de inspeção óptica automatizada (Automated Optical Inspection) para controle de qualidade industrial com visão computacional.</p>
            <span className="tag">Indústria 4.0</span>
            <span className="product-link">Em breve →</span>
          </div>
        </div>
      </section>

      <section className="features" id="solucoes">
        <div className="features-inner">
          <div className="section-title">Por que Arkiel</div>
          <h2 className="section-sub">Tecnologia que simplifica o seu dia</h2>
          <div className="feature-grid">
            <div className="feature">
              <div className="feature-num">01</div>
              <h4>Automação real</h4>
              <p>Bots que atendem, vendem e gerenciam pedidos sem intervenção humana. Seu time foca no que importa.</p>
            </div>
            <div className="feature">
              <div className="feature-num">02</div>
              <h4>Pagamentos integrados</h4>
              <p>PIX e cartões via Mercado Pago direto no WhatsApp. Split automático de taxas e comprovantes.</p>
            </div>
            <div className="feature">
              <div className="feature-num">03</div>
              <h4>Catálogo nativo</h4>
              <p>Sincronização com o catálogo oficial do WhatsApp. Produtos, preços e pedidos em um só lugar.</p>
            </div>
            <div className="feature">
              <div className="feature-num">04</div>
              <h4>Multi-tenant</h4>
              <p>Cada cliente tem seu próprio bot, número e dados isolados. Gerencie tudo de um painel central.</p>
            </div>
            <div className="feature">
              <div className="feature-num">05</div>
              <h4>Conexão por SMS</h4>
              <p>Ative números sem precisar de conta no Facebook. Cadastre o telefone e receba o código por SMS.</p>
            </div>
            <div className="feature">
              <div className="feature-num">06</div>
              <h4>Identidade visual</h4>
              <p>Interface no padrão WhatsApp. Logo e cores da Arkiel em todos os pontos de contato.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section" id="contato">
        <h2>Pronto para automatizar?</h2>
        <p>Fale com a gente e descubra como a Arkiel pode transformar o seu atendimento.</p>
        <div className="hero-cta">
          <Link href="/assistente-ark" className="btn-hero-primary">Acessar plataforma</Link>
          <a href="https://wa.me/5511913751590" target="_blank" rel="noopener" className="btn-hero-ghost">Falar no WhatsApp</a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-logo">
          <img src="/logo-arkiel.png" alt="Arkiel" />
          <span>ARKIEL</span>
        </div>
        <div className="footer-links">
          <Link href="/assistente-ark">Assistente Ark</Link>
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Privacidade</Link>
          <a href="mailto:arkieltech@gmail.com">Contato</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} Arkiel Tecnologia. Todos os direitos reservados.</div>
      </footer>
    </>
  )
}
