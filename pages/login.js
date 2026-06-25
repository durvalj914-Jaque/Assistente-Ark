import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import Link from 'next/link'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/admin` }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Erro ao entrar com Google.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Entrar — Arkiel</title>
        <meta name="description" content="Acesse sua conta Arkiel." />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #fff; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .login-root {
          min-height: 100vh; background: #000;
          display: flex; position: relative; overflow: hidden;
        }
        .bg-grid {
          position: fixed; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 72px 72px; pointer-events: none; z-index: 0;
        }
        .bg-glow {
          position: fixed; top: 50%; left: 30%; transform: translate(-50%,-50%);
          width: 800px; height: 800px; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse, rgba(79,142,247,0.06) 0%, transparent 65%);
        }

        /* LEFT */
        .left-panel {
          flex: 1; display: flex; flex-direction: column;
          justify-content: space-between; padding: 48px 64px;
          position: relative; z-index: 1;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .left-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .left-logo img { width: 38px; height: 38px; object-fit: contain; }
        .left-logo span { font-size: 14px; font-weight: 800; letter-spacing: 4px; color: #fff; text-transform: uppercase; }
        .left-hero { padding: 40px 0; }
        .left-tag {
          display: inline-flex; align-items: center; gap: 8px;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 100px;
          padding: 5px 14px; font-size: 11px; font-weight: 500;
          color: rgba(255,255,255,0.4); margin-bottom: 28px;
          background: rgba(255,255,255,0.02); letter-spacing: 0.5px;
        }
        .left-title {
          font-size: clamp(36px, 4vw, 56px); font-weight: 900;
          letter-spacing: -2px; color: #fff; line-height: 1.05; margin-bottom: 20px;
        }
        .left-title .accent {
          background: linear-gradient(135deg, #4f8ef7, #06b6d4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .left-sub { font-size: 15px; color: rgba(255,255,255,0.32); line-height: 1.75; max-width: 420px; }
        .left-stats { display: flex; gap: 32px; }
        .left-stat-n { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
        .left-stat-l { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 2px; }

        /* RIGHT */
        .right-panel {
          width: 460px; display: flex; flex-direction: column;
          justify-content: center; padding: 60px 48px;
          position: relative; z-index: 1;
          background: rgba(255,255,255,0.01);
        }
        .login-card-title { font-size: 26px; font-weight: 800; letter-spacing: -0.8px; color: #fff; margin-bottom: 8px; }
        .login-card-sub { font-size: 13px; color: rgba(255,255,255,0.3); margin-bottom: 36px; line-height: 1.6; }
        .btn-google {
          width: 100%; padding: 15px 20px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.97); color: #111;
          font-size: 15px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          transition: all 0.2s; font-family: inherit; letter-spacing: -0.2px;
        }
        .btn-google:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(255,255,255,0.1); }
        .btn-google:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .error-box {
          background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px; padding: 12px 16px; font-size: 13px;
          color: #f87171; margin-top: 16px; line-height: 1.5;
        }
        .login-divider {
          display: flex; align-items: center; gap: 14px; margin: 28px 0 24px;
        }
        .login-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .login-divider-text { font-size: 11px; color: rgba(255,255,255,0.18); letter-spacing: 1px; text-transform: uppercase; }
        .login-features { display: flex; flex-direction: column; gap: 12px; }
        .login-feat {
          display: flex; align-items: center; gap: 12px;
          font-size: 13px; color: rgba(255,255,255,0.35);
        }
        .login-feat-ic {
          width: 30px; height: 30px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; flex-shrink: 0; background: rgba(255,255,255,0.02);
        }
        .login-footer-note {
          margin-top: 36px; font-size: 11px; color: rgba(255,255,255,0.15);
          line-height: 1.8; text-align: center;
        }
        .login-footer-note a { color: rgba(255,255,255,0.28); text-decoration: none; }
        .login-footer-note a:hover { color: rgba(255,255,255,0.55); }
        @media (max-width: 900px) {
          .left-panel { display: none; }
          .right-panel { width: 100%; background: #000; padding: 60px 28px; }
        }
      `}</style>

      <div className="login-root">
        <div className="bg-grid" />
        <div className="bg-glow" />

        {/* Left */}
        <div className="left-panel">
          <Link href="/" className="left-logo">
            <img src="/arkiel-logo.png" alt="Arkiel" />
            <span>Arkiel</span>
          </Link>

          <div className="left-hero">
            <div className="left-tag">Plataforma Arkiel · v2.0</div>
            <h1 className="left-title">
              Bem-vindo<br />de <span className="accent">volta.</span>
            </h1>
            <p className="left-sub">Acesse seu painel para gerenciar chatbots, conversas e automações inteligentes.</p>
          </div>

          <div className="left-stats">
            {[
              { n: '10k+', l: 'Msgs/dia' },
              { n: '99.9%', l: 'Uptime' },
              { n: '<1s', l: 'Resposta' },
            ].map(s => (
              <div key={s.n}>
                <div className="left-stat-n">{s.n}</div>
                <div className="left-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="right-panel">
          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48, justifyContent: 'center' }}>
            <img src="/arkiel-logo.png" alt="Arkiel" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 4, color: '#fff', textTransform: 'uppercase' }}>Arkiel</span>
          </div>

          <h2 className="login-card-title">Acesse sua conta</h2>
          <p className="login-card-sub">Use sua conta Google para entrar com segurança no painel Arkiel.</p>

          <button onClick={handleGoogleLogin} disabled={loading} className="btn-google">
            {loading ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#999" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </circle>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Redirecionando…' : 'Continuar com Google'}
          </button>

          {error && <div className="error-box">{error}</div>}

          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">Incluso no plano</span>
            <div className="login-divider-line" />
          </div>

          <div className="login-features">
            {[
              { ic: '⚡', txt: 'Chatbots WhatsApp ilimitados' },
              { ic: '🧠', txt: 'IA com respostas automáticas' },
              { ic: '📊', txt: 'Analytics em tempo real' },
              { ic: '🔒', txt: 'Dados isolados e seguros' },
            ].map(f => (
              <div key={f.txt} className="login-feat">
                <div className="login-feat-ic">{f.ic}</div>
                {f.txt}
              </div>
            ))}
          </div>

          <div className="login-footer-note">
            Ao entrar, você concorda com os{' '}
            <Link href="/termos">Termos de Uso</Link> e a{' '}
            <Link href="/privacidade">Política de Privacidade</Link>.<br />
            © {new Date().getFullYear()} Arkiel Tecnologia LTDA.
          </div>
        </div>
      </div>
    </>
  )
}
