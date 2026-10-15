import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Portão de 2FA para o console Arkiel (/painel) ──
// Se o platform admin tem TOTP ativo, o console exige o código de 6 dígitos
// uma vez por sessão do navegador (flag no sessionStorage).
export default function TotpGate({ profile, pathname }) {
  const [need, setNeed] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [checking, setChecking] = useState(false)

  const isConsole = pathname === '/painel' || pathname.startsWith('/painel/')

  useEffect(() => {
    if (profile?.is_platform_admin && profile?.totp_enabled && isConsole) {
      try { setNeed(sessionStorage.getItem('ark-2fa-ok') !== '1') } catch (_) { setNeed(true) }
    }
  }, [profile?.is_platform_admin, profile?.totp_enabled, pathname])

  if (!need) return null

  async function verify() {
    if (checking) return
    setChecking(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/admin/2fa', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'verify', code }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || 'Código inválido'); setChecking(false); return }
      try { sessionStorage.setItem('ark-2fa-ok', '1') } catch (_) {}
      setNeed(false)
    } catch (_) { setErr('Falha de conexão'); }
    setChecking(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>Verificação em 2 etapas</h2>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', margin: '0 0 18px', lineHeight: 1.5 }}>
          O console Arkiel exige seu código de 6 dígitos do app autenticador.
        </p>
        <input
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          placeholder="000000" inputMode="numeric" autoFocus
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 22, letterSpacing: 6, textAlign: 'center', marginBottom: 14, outline: 'none' }}
        />
        {err && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
        <button onClick={verify} disabled={code.length !== 6 || checking} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: code.length === 6 ? '#25D366' : 'rgba(255,255,255,0.12)',
          color: code.length === 6 ? '#0a0a0a' : 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 700,
        }}>
          {checking ? 'Verificando...' : 'Entrar no console'}
        </button>
      </div>
    </div>
  )
}
