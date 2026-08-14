import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Head from 'next/head'

export default function AssistenteArkPage() {
  const router = useRouter()

  // If already logged in, redirect to painel
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/painel')
    })
  }, [])

  return (
    <>
      <Head>
        <title>Assistente Ark — Automação Inteligente para WhatsApp Business</title>
        <meta name="description" content="Plataforma SaaS para criar e gerenciar chatbots de WhatsApp com IA, catálogo de produtos, pagamentos integrados e painel administrativo." />
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
        .nav-logo img { height: 36px; width: auto; }
        .nav-back { padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.65); font-size: 13px; font-weight: 500; text-decoration: none; transition: all .15s; background: transparent; }
        .nav-back:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .nav-login { padding: 8px 20px; border-radius: 8px; background: #25D366; color: #0a0a0a; font-size: 13px; font-weight: 700; text-decoration: none; transition: all .15s; }
        .nav-login:hover { background: #1fb855; }

        .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 120px 24px 80px; text-align: center; position: relative; overflow: hidden; }
        .hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(37,211,102,0.12), transparent 60%); pointer-events: none; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 100px; background: rgba(37,211,102,0.1); border: 1px solid rgba(37,211,102,0.2); color: #25D366; font-size: 12px; font-weight: 600; margin-bottom: 28px; }
        .hero h1 { font-size: clamp(36px, 5.5vw, 64px); font-weight: 800; letter-spacing: -2px; line-height: 1.05; max-width: 720px; margin-bottom: 24px; }
        .hero h1 span { background: linear-gradient(135deg, #25D366, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero p { font-size: clamp(15px, 1.8vw, 19px); color: rgba(255,255,255,0.55); max-width: 540px; line-height: 1.6; margin-bottom: 40px; }
        .hero-cta { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .btn-hero-primary { padding: 14px 32px; border-radius: 12px; background: #25D366; color: #0a0a0a; font-size: 15px; font-weight: 700; text-decoration: none; transition: all .2s; }
        .btn-hero-primary:hover { background: #1fb855; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(37,211,102,0.3); }
        .btn-hero-ghost { padding: 14px 32px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 15px; font-weight: 500; text-decoration: none; transition: all .2s; background: transparent; }
        .btn-hero-ghost:hover { border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); }

        .features { padding: 100px 24px; max-width: 1100px; margin: 0 auto; }
        .section-title { font-size: 14px; font-weight: 700; color: #25D366; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; text-align: center; }
        .section-sub { font-size: clamp(28px, 4vw, 44px); font-weight: 800; text-align: center; margin-bottom: 56px; letter-spacing: -1px; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
        .feature-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px; transition: all .2s; }
        .feature-card:hover { border-color: rgba(37,211,102,0.2); background: rgba(37,211,102,0.03); }
        .feature-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
        .feature-card p { color: rgba(255,255,255,0.45); font-size: 14px; line-height: 1.6; }

        .cta-section { padding: 120px 24px; text-align: center; }
        .cta-section h2 { font-size: clamp(32px, 5vw, 48px); font-weight: 800; letter-spacing: -1px; margin-bottom: 20px; }
        .cta-section p { color: rgba(255,255,255,0.5); font-size: 17px; margin-bottom: 36px; }

        .footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 48px 24px; text-align: center; }
        .footer-logo { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
        .footer-logo img { height: 32px; width: auto; }
        .footer-links { display: flex; justify-content: center; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
        .footer-links a { color: rgba(255,255,255,0.4); font-size: 13px; text-decoration: none; transition: color .15s; }
        .footer-links a:hover { color: #fff; }
        .footer-copy { color: rgba(255,255,255,0.25); font-size: 12px; }

        @media (max-width: 768px) {
          .nav { padding: 0 16px; }
          .hero { padding: 100px 20px 60px; }
          .features { padding: 60px 20px; }
        }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <img src="/logo-arkiel.png" alt="Arkiel" />
        </Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/" className="nav-back">← Site</Link>
          <Link href="/assistente-ark/entrar" className="nav-login">Entrar</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">💬 WhatsApp Business</div>
        <h1>Assistente <span>Ark</span></h1>
        <p>Crie e gerencie chatbots de WhatsApp com inteligência artificial. Catálogo de produtos, pagamentos integrados e atendimento automatizado — tudo em um painel.</p>
        <div className="hero-cta">
          <Link href="/assistente-ark/entrar" className="btn-hero-primary">Acessar plataforma</Link>
          <a href="#recursos" className="btn-hero-ghost">Conhecer recursos</a>
        </div>
      </section>

      <section className="features" id="recursos">
        <div className="section-title">Recursos</div>
        <h2 className="section-sub">Tudo que você precisa para automatizar</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>🤖 Chatbot com IA</h3>
            <p>Fluxos de conversação visuais sem código. Nó de menu, mensagem, catálogo, pagamento e transferência humana.</p>
          </div>
          <div className="feature-card">
            <h3>🛒 Catálogo nativo</h3>
            <p>Sincronização automática com o catálogo oficial do WhatsApp. Produtos, preços e pedidos direto no chat.</p>
          </div>
          <div className="feature-card">
            <h3>💳 Pagamentos integrados</h3>
            <p>PIX dinâmico e checkout Mercado Pago no fluxo de pedidos. Split de taxas configurável por método.</p>
          </div>
          <div className="feature-card">
            <h3>📱 Conexão por SMS</h3>
            <p>Ative números sem conta no Facebook. Cadastre o telefone, receba o código e pronto.</p>
          </div>
          <div className="feature-card">
            <h3>👥 Multi-tenant</h3>
            <p>Cada cliente tem seu próprio bot, número e dados isolados. Painel central para gerenciar tudo.</p>
          </div>
          <div className="feature-card">
            <h3>📊 Painel completo</h3>
            <p>Dashboard, conversas, contatos, logs e métricas em tempo real. Importação de contatos via VCF/CSV.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Pronto para começar?</h2>
        <p>Acesse a plataforma e gerencie seus bots de WhatsApp.</p>
        <div className="hero-cta">
          <Link href="/assistente-ark/entrar" className="btn-hero-primary">Entrar na plataforma</Link>
          <a href="https://wa.me/5511913751590" target="_blank" rel="noopener" className="btn-hero-ghost">Falar no WhatsApp</a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-logo">
          <img src="/logo-arkiel.png" alt="Arkiel" />
        </div>
        <div className="footer-links">
          <Link href="/">Arkiel</Link>
          <Link href="/assistente-ark/entrar">Entrar</Link>
          <a href="https://www.arkiel.com.br/termos">Termos</a>
          <a href="https://www.arkiel.com.br/privacidade">Privacidade</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} Arkiel Tecnologia.</div>
      </footer>
    </>
  )
}
