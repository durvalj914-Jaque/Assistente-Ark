import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', company: '' })
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { company: form.company } }
        })
        if (error) throw error
        setError('✅ Verifique seu e-mail para confirmar o cadastro.')
        setLoading(false)
        return
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password
        })
        if (error) throw error
        if (data?.session) {
          router.push('/admin')
        } else {
          throw new Error('Sessão não iniciada. Tente novamente.')
        }
      }
    } catch (err) {
      setError(err.message || 'Erro ao entrar. Verifique seus dados.')
    }
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
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
      setGoogleLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(79,142,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 400, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Assistente Ark
          </h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta gratuita'}
          </p>
        </div>

        {/* Botão Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          style={{
            width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
            background: '#fff', color: '#1f2937', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginBottom: 20, transition: 'opacity 0.2s', opacity: googleLoading ? 0.7 : 1
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Redirecionando…' : 'Continuar com Google'}
        </button>

        {/* Divisor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ color: '#475569', fontSize: 12 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>NOME DA EMPRESA</label>
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Ex: Empresa ABC" className="ark-input" required />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>E-MAIL</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="seu@email.com" className="ark-input" required />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>SENHA</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" className="ark-input" required minLength={6} />
          </div>

          {error && (
            <div style={{ background: error.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${error.startsWith('✅') ? '#10b981' : '#ef4444'}40`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: error.startsWith('✅') ? '#10b981' : '#ef4444', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="ark-btn" style={{ width: '100%', padding: 12, fontSize: 14 }} disabled={loading}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta grátis'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 13 }}>
            {mode === 'login' ? 'Não tem conta? Cadastre-se grátis' : 'Já tem conta? Entrar'}
          </button>
        </div>

        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button onClick={async () => {
              if (!form.email) { setError('Digite seu e-mail'); return }
              await supabase.auth.resetPasswordForEmail(form.email)
              setError('✅ E-mail de recuperação enviado!')
            }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>
              Esqueci minha senha
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
