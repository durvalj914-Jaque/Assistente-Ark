import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`
        }
      })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Erro ao entrar com Google.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(79,142,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 20, padding: '48px 36px', width: '100%', maxWidth: 400, position: 'relative', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
          Assistente Ark
        </h1>
        <p style={{ color: '#475569', fontSize: 14, marginBottom: 36 }}>
          Entre na sua conta para continuar
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: '#fff', color: '#1f2937', fontSize: 15, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'opacity 0.2s', opacity: loading ? 0.7 : 1
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Redirecionando…' : 'Continuar com Google'}
        </button>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginTop: 16 }}>
            {error}
          </div>
        )}

        <p style={{ color: '#2d3748', fontSize: 12, marginTop: 32 }}>
          Arkiel © {new Date().getFullYear()} — Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
