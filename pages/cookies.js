import Head from 'next/head'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Cookies() {
  return (
    <>
      <Head>
        <title>Política de Cookies — Arkiel</title>
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #fff; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .legal-root { background: #000; min-height: 100vh; }
        .legal-hero { padding: 140px 80px 60px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .legal-tag { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #4f8ef7; text-transform: uppercase; margin-bottom: 14px; }
        .legal-title { font-size: 48px; font-weight: 900; letter-spacing: -2px; color: #fff; margin-bottom: 12px; }
        .legal-date { font-size: 13px; color: rgba(255,255,255,0.25); }
        .legal-body { max-width: 760px; margin: 0 auto; padding: 60px 80px 80px; }
        .legal-body h2 { font-size: 20px; font-weight: 700; color: #fff; margin: 40px 0 14px; }
        .legal-body h2:first-child { margin-top: 0; }
        .legal-body p { font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.85; margin-bottom: 16px; }
        .cookies-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .cookies-table th { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.3); text-align: left; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .cookies-table td { font-size: 13px; color: rgba(255,255,255,0.4); padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); line-height: 1.5; }
        .cookie-type { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
        .cookie-essential { background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
        .cookie-analytics { background: rgba(79,142,247,0.1); color: #4f8ef7; border: 1px solid rgba(79,142,247,0.2); }
        .legal-contact { margin-top: 48px; padding: 28px 32px; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; background: rgba(255,255,255,0.02); }
        .legal-contact p { margin: 0; }
        .legal-contact a { color: #4f8ef7; text-decoration: none; }
        @media (max-width: 768px) { .legal-hero, .legal-body { padding-left: 24px; padding-right: 24px; } .legal-title { font-size: 32px; } }
      `}</style>
      <div className="legal-root">
        <Navbar />
        <div className="legal-hero" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="legal-tag">Legal</div>
          <h1 className="legal-title">Política de Cookies</h1>
          <p className="legal-date">Última atualização: junho de 2025</p>
        </div>
        <div className="legal-body">
          <h2>O que são Cookies?</h2>
          <p>Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você acessa a Plataforma Arkiel. Eles permitem que a Plataforma reconheça seu dispositivo e mantenha informações de sessão entre visitas.</p>

          <h2>Cookies que Utilizamos</h2>
          <table className="cookies-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Finalidade</th>
                <th>Duração</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>sb-session</td>
                <td><span className="cookie-type cookie-essential">Essencial</span></td>
                <td>Autenticação e manutenção de sessão do usuário</td>
                <td>1 hora</td>
              </tr>
              <tr>
                <td>sb-refresh-token</td>
                <td><span className="cookie-type cookie-essential">Essencial</span></td>
                <td>Renovação automática da sessão autenticada</td>
                <td>30 dias</td>
              </tr>
              <tr>
                <td>ark-preferences</td>
                <td><span className="cookie-type cookie-essential">Essencial</span></td>
                <td>Preferências de interface e configurações do usuário</td>
                <td>1 ano</td>
              </tr>
              <tr>
                <td>_vercel_analytics</td>
                <td><span className="cookie-type cookie-analytics">Analytics</span></td>
                <td>Análise de performance e uso da plataforma</td>
                <td>Sessão</td>
              </tr>
            </tbody>
          </table>

          <h2>Gerenciamento de Cookies</h2>
          <p>Os cookies essenciais não podem ser desativados, pois são necessários para o funcionamento da Plataforma. Os cookies analíticos podem ser gerenciados nas configurações do seu navegador.</p>
          <p>Para remover cookies existentes ou impedir novos cookies, consulte as configurações do seu navegador:</p>
          <p style={{ color: 'rgba(255,255,255,0.3)' }}>Chrome: Configurações → Privacidade e segurança → Cookies · Firefox: Opções → Privacidade e segurança · Safari: Preferências → Privacidade</p>

          <div className="legal-contact">
            <p>Dúvidas sobre cookies? <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a></p>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
