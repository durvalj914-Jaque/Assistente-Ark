import Link from 'next/link'
import Head from 'next/head'

// Layout compartilhado das páginas legais (Privacidade / Termos).
// Props:
//   title    — título do documento (h1)
//   subtitle — linha de apoio
//   updated  — data da última atualização
//   seoTitle — <title> da aba
//   children — corpo do documento
export default function LegalPage({ title, subtitle, updated, seoTitle, children }) {
  return (
    <>
      <Head>
        <title>{seoTitle} — Assistente Ark</title>
        <meta name="robots" content="index, follow" />
        <link rel="icon" href="/assistente-ark-mascot.png" />
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
        .nav-logo img { height: 38px; width: 38px; border-radius: 10px; }
        .nav-back { padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.65); font-size: 13px; font-weight: 500; text-decoration: none; transition: all .15s; background: transparent; }
        .nav-back:hover { border-color: rgba(255,255,255,0.25); color: #fff; }

        .legal-hero { padding: 140px 24px 60px; max-width: 780px; margin: 0 auto; }
        .legal-hero::before { content: ''; display: block; width: 48px; height: 4px; border-radius: 2px; background: #25D366; margin-bottom: 24px; }
        .legal-hero h1 { font-size: clamp(30px, 5vw, 44px); font-weight: 800; letter-spacing: -1.5px; margin-bottom: 14px; }
        .legal-hero p { color: rgba(255,255,255,0.5); font-size: 16px; line-height: 1.6; }
        .legal-updated { display: inline-block; margin-top: 18px; padding: 4px 12px; border-radius: 100px; background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.2); color: #25D366; font-size: 12px; font-weight: 600; }

        .legal-body { padding: 0 24px 60px; max-width: 780px; margin: 0 auto; }
        .legal-body h2 { font-size: 20px; font-weight: 700; margin: 40px 0 12px; letter-spacing: -0.5px; }
        .legal-body h3 { font-size: 15px; font-weight: 700; margin: 24px 0 8px; color: rgba(255,255,255,0.85); }
        .legal-body p { color: rgba(255,255,255,0.6); font-size: 14.5px; line-height: 1.75; margin-bottom: 12px; }
        .legal-body ul { margin: 0 0 16px 20px; }
        .legal-body li { color: rgba(255,255,255,0.6); font-size: 14.5px; line-height: 1.7; margin-bottom: 6px; }
        .legal-body strong { color: rgba(255,255,255,0.9); font-weight: 600; }
        .legal-body a { color: #25D366; text-decoration: none; }
        .legal-body a:hover { text-decoration: underline; }
        .legal-body table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 13.5px; }
        .legal-body th { text-align: left; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); font-weight: 600; }
        .legal-body td { padding: 10px 12px; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); line-height: 1.5; }

        .footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 40px 24px; text-align: center; }
        .footer-links { display: flex; justify-content: center; gap: 24px; margin-bottom: 16px; flex-wrap: wrap; }
        .footer-links a { color: rgba(255,255,255,0.4); font-size: 13px; text-decoration: none; transition: color .15s; }
        .footer-links a:hover { color: #fff; }
        .footer-copy { color: rgba(255,255,255,0.25); font-size: 12px; }

        @media (max-width: 768px) {
          .nav { padding: 0 16px; }
          .legal-hero { padding: 120px 20px 40px; }
          .legal-body { padding: 0 20px 40px; }
          .legal-body table { display: block; overflow-x: auto; }
        }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <img src="/assistente-ark-mascot.png" alt="Assistente Ark" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Assistente Ark</span>
        </Link>
        <Link href="/" className="nav-back">← Voltar</Link>
      </nav>

      <section className="legal-hero">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span className="legal-updated">Última atualização: {updated}</span>
      </section>

      <main className="legal-body">{children}</main>

      <footer className="footer">
        <div className="footer-links">
          <Link href="/">Assistente Ark</Link>
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/termos">Termos de Uso</Link>
          <a href="mailto:arkieltech@gmail.com">Contato</a>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} Arkiel Tecnologia — Assistente Ark. Todos os direitos reservados.</div>
      </footer>
    </>
  )
}
