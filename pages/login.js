import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
        <title>Arkiel — Plataforma de Automação Inteligente</title>
        <meta name="description" content="Automatize seu atendimento com inteligência artificial. Plataforma SaaS multi-tenant para chatbots WhatsApp." />
      </Head>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #000;
          font-family: 'Inter', -apple-system, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }

        .login-root {
          min-height: 100vh;
          background: #000;
          display: flex;
          position: relative;
          overflow: hidden;
        }

        /* Grid lines de fundo */
        .grid-bg {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
          z-index: 0;
        }

        /* Glow central */
        .glow-center {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 900px;
          height: 900px;
          background: radial-gradient(ellipse at center,
            rgba(79,142,247,0.08) 0%,
            rgba(6,182,212,0.04) 40%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 0;
        }

        /* Glow top-right */
        .glow-tr {
          position: fixed;
          top: -200px;
          right: -200px;
          width: 600px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(79,142,247,0.06) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        /* Partículas decorativas */
        .particle {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          animation: float 8s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.1); opacity: 0.8; }
        }

        /* Layout principal */
        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 60px 80px;
          position: relative;
          z-index: 1;
        }

        .right-panel {
          width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          z-index: 1;
          border-left: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.015);
          backdrop-filter: blur(20px);
        }

        /* Logo */
        .logo-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 80px;
        }
        .logo-img {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 4px;
          color: #fff;
          text-transform: uppercase;
        }

        /* Hero text */
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(79,142,247,0.08);
          border: 1px solid rgba(79,142,247,0.2);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #4f8ef7;
          letter-spacing: 0.5px;
          margin-bottom: 28px;
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          background: #4f8ef7;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .hero-title {
          font-size: 64px;
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -2px;
          color: #fff;
          margin-bottom: 24px;
        }
        .hero-title .gradient-text {
          background: linear-gradient(135deg, #4f8ef7 0%, #06b6d4 50%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 17px;
          color: rgba(255,255,255,0.4);
          line-height: 1.7;
          max-width: 480px;
          margin-bottom: 48px;
          font-weight: 400;
        }

        /* Stats */
        .stats-row {
          display: flex;
          gap: 40px;
        }
        .stat-item {}
        .stat-number {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -1px;
        }
        .stat-label {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          font-weight: 500;
          margin-top: 2px;
          letter-spacing: 0.3px;
        }
        .stat-divider {
          width: 1px;
          background: rgba(255,255,255,0.08);
          height: 40px;
          align-self: center;
        }

        /* Card de login */
        .login-card {
          width: 100%;
          max-width: 380px;
        }

        .card-title {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }
        .card-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          margin-bottom: 36px;
          font-weight: 400;
          line-height: 1.6;
        }

        /* Botão Google */
        .btn-google {
          width: 100%;
          padding: 15px 20px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.97);
          color: #111;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s ease;
          font-family: 'Inter', sans-serif;
          letter-spacing: -0.2px;
          position: relative;
          overflow: hidden;
        }
        .btn-google::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(79,142,247,0.08), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .btn-google:hover::before { opacity: 1; }
        .btn-google:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 40px rgba(79,142,247,0.2);
          border-color: rgba(79,142,247,0.3);
        }
        .btn-google:active { transform: scale(0.99); }
        .btn-google:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 24px 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }
        .divider-text {
          font-size: 11px;
          color: rgba(255,255,255,0.2);
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        /* Features */
        .features-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 8px;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          font-weight: 400;
        }
        .feature-icon {
          width: 28px;
          height: 28px;
          background: rgba(79,142,247,0.08);
          border: 1px solid rgba(79,142,247,0.15);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          flex-shrink: 0;
        }

        /* Error */
        .error-box {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 13px;
          color: #f87171;
          margin-top: 16px;
          line-height: 1.5;
        }

        /* Footer */
        .login-footer {
          margin-top: 40px;
          font-size: 11px;
          color: rgba(255,255,255,0.15);
          text-align: center;
          line-height: 1.8;
        }
        .login-footer a { color: rgba(255,255,255,0.25); text-decoration: none; }
        .login-footer a:hover { color: rgba(255,255,255,0.45); }

        /* Responsive */
        @media (max-width: 900px) {
          .left-panel { display: none; }
          .right-panel {
            width: 100%;
            border-left: none;
            background: #000;
            min-height: 100vh;
          }
        }
      `}</style>

      <div className="login-root">
        {/* Backgrounds */}
        <div className="grid-bg" />
        <div className="glow-center" />
        <div className="glow-tr" />

        {/* Partículas */}
        <div className="particle" style={{ width: 3, height: 3, background: '#4f8ef7', top: '20%', left: '15%', animationDelay: '0s' }} />
        <div className="particle" style={{ width: 2, height: 2, background: '#06b6d4', top: '60%', left: '25%', animationDelay: '2s' }} />
        <div className="particle" style={{ width: 4, height: 4, background: '#8b5cf6', top: '35%', left: '60%', animationDelay: '4s' }} />
        <div className="particle" style={{ width: 2, height: 2, background: '#4f8ef7', top: '75%', left: '45%', animationDelay: '1s' }} />

        {/* Painel esquerdo — Hero */}
        <div className="left-panel">
          <div className="logo-wrap">
            <img src="/arkiel-logo.png" alt="Arkiel" className="logo-img" />
            <span className="logo-text">Arkiel</span>
          </div>

          <div className="hero-badge">
            <span className="badge-dot" />
            Plataforma ativa · 99.9% uptime
          </div>

          <h1 className="hero-title">
            Automação<br />
            <span className="gradient-text">inteligente</span><br />
            para o seu<br />negócio.
          </h1>

          <p className="hero-subtitle">
            Gerencie chatbots de WhatsApp, automatize atendimentos e escale seu negócio com inteligência artificial — sem código, sem complicação.
          </p>

          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-number">10k+</div>
              <div className="stat-label">Mensagens/dia</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">99.9%</div>
              <div className="stat-label">Disponibilidade</div>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <div className="stat-number">< 1s</div>
              <div className="stat-label">Tempo de resposta</div>
            </div>
          </div>
        </div>

        {/* Painel direito — Card de login */}
        <div className="right-panel">
          <div className="login-card">
            {/* Logo mobile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, justifyContent: 'center' }}>
              <img src="/arkiel-logo.png" alt="Arkiel" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 4, color: '#fff', textTransform: 'uppercase' }}>Arkiel</span>
            </div>

            <h2 className="card-title">Bem-vindo de volta</h2>
            <p className="card-sub">
              Acesse sua conta para gerenciar seus agentes e automações.
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn-google"
            >
              {loading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#ccc" strokeWidth="2" strokeDasharray="31.4" strokeDashoffset="10">
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

            <div className="divider">
              <div className="divider-line" />
              <span className="divider-text">Incluído no plano</span>
              <div className="divider-line" />
            </div>

            <div className="features-list">
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                Chatbots WhatsApp ilimitados
              </div>
              <div className="feature-item">
                <div className="feature-icon">🧠</div>
                IA com respostas automáticas
              </div>
              <div className="feature-item">
                <div className="feature-icon">📊</div>
                Analytics em tempo real
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                Multi-tenant com isolamento total
              </div>
            </div>

            <div className="login-footer">
              © {new Date().getFullYear()} Arkiel Tecnologia.<br />
              <a href="#">Termos de uso</a> · <a href="#">Privacidade</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
