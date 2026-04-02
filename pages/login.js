import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // login | register
  const [form, setForm] = useState({ email: '', password: '', company: '' })
  const [loading, setLoading] = useState(false)
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
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
        router.push('/admin')
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(79,142,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ background: '#0a0a14', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Assistente Ark
          </h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta gratuita'}
          </p>
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
