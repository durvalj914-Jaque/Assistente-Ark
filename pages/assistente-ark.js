import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Head from 'next/head'

export default function AssistenteArk() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/painel')
      else setChecking(false)
    })
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/painel`,
        },
      })
      if (error) setError(error.message)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (checking) return <div style={{ background: '#0a0a0a', minHeight: '100vh' }} />

  return (
    <>
      <Head>
        <title>Assistente Ark — Plataforma de Automação WhatsApp</title>
        <meta name="description" content="Acesse a plataforma Assistente Ark para gerenciar seus chatbots de WhatsApp Business." />
        <link rel="icon" href="/logo-arkiel.png" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; }

        .login-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; position: relative; overflow: hidden; }
        .login-wrap::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 30%, rgba(37,211,102,0.1), transparent 60%); pointer-events: none; }

        .back-link { position: absolute; top: 24px; left: 24px; color: rgba(255,255,255,0.4); font-size: 13px; text-decoration: none; transition: color .15s; z-index: 10; }
        .back-link:hover { color: #fff; }

        .login-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .login-logo img { width: 48px; height: 48px; }
        .login-logo span { font-size: 16px; font-weight: 800; letter-spacing: 4px; color: #fff; text-transform: uppercase; }

        .login-badge { font-size: 12px; color: #25D366; font-weight: 600; margin-bottom: 32px; letter-spacing: 1px; }

        .login-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 48px 40px; max-width: 420px; width: 100%; }
        .login-card h1 { font-size: 26px; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px; }
        .login-card p { color: rgba(255,255,255,0.45); font-size: 15px; margin-bottom: 32px; line-height: 1.5; }

        .btn-google { width: 100%; padding: 14px 24px; border-radius: 12px; background: #fff; color: #1a1a1a; font-size: 15px; font-weight: 600; border: none; cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 12px; }
        .btn-google:hover { background: #f0f0f0; transform: translateY(-1px); }
        .btn-google:disabled { opacity: 0.6; cursor: wait; }
        .btn-google svg { width: 20px; height: 20px; }

        .login-err { margin-top: 16px; padding: 12px 16px; border-radius: 10px; background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2); color: #ff6868; font-size: 13px; }

        .login-info { margin-top: 24px; font-size: 12px; color: rgba(255,255,255,0.3); }
        .login-info a { color: #25D366; text-decoration: none; }
      `}</style>

      <div className="login-wrap">
        <Link href="/" className="back-link">← Voltar para o site</Link>

        <div className="login-logo">
          <img src="/logo-arkiel.png" alt="Arkiel" />
          <span>ARKIEL</span>
        </div>
        <div className="login-badge">ASSISTENTE ARK</div>

        <div className="login-card">
          <h1>Acessar plataforma</h1>
          <p>Entre com sua conta Google para acessar o painel de gerenciamento dos seus bots de WhatsApp.</p>

          <button className="btn-google" onClick={handleGoogleLogin} disabled={loading}>
            {loading ? 'Conectando...' : (
              <>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Entrar com Google
              </>
            )}
          </button>

          {error && <div className="login-err">{error}</div>}
        </div>

        <div className="login-info">
          Não tem uma conta? <a href="https://wa.me/5511913751590" target="_blank" rel="noopener">Fale conosco</a>
        </div>
      </div>
    </>
  )
}
