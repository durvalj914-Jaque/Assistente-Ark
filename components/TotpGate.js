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
      ;(async () => {
        let localOk = false
        try { localOk = sessionStorage.getItem('ark-2fa-ok') === '1' } catch (_) {}
        if (!localOk) { setNeed(true); return }
        // Enforcement server-side: o sessionStorage NÃO é mais suficiente —
        // pergunta ao servidor se a verificação 2FA ainda vale (janela de 8h).
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const r = await fetch('/api/admin/2fa', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
            body: JSON.stringify({ action: 'check' }),
          })
          const j = await r.json().catch(() => ({}))
          if (!j.ok) { try { sessionStorage.removeItem('ark-2fa-ok') } catch (_) {} setNeed(true) }
        } catch (_) { setNeed(true) }
      })()
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
    <>
      <style>{`.ark-2fa-err{color:#ff6b6b}[data-theme="light"] .ark-2fa-err{color:#dc2626}`}</style>
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>Verificação em 2 etapas</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
          O console Arkiel exige seu código de 6 dígitos do app autenticador.
        </p>
        <input
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          placeholder="000000" inputMode="numeric" autoFocus
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 22, letterSpacing: 6, textAlign: 'center', marginBottom: 14, outline: 'none' }}
        />
        {err && <p className='ark-2fa-err' style={{ fontSize: 13, margin: '0 0 10px' }}>{err}</p>}
        <button onClick={verify} disabled={code.length !== 6 || checking} style={{
          width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: code.length === 6 ? '#25D366' : 'var(--bg-hover)',
          color: code.length === 6 ? '#0a0a0a' : 'var(--text-muted)', fontSize: 14, fontWeight: 700,
        }}>
          {checking ? 'Verificando...' : 'Entrar no console'}
        </button>
      </div>
    </div>
    </>
  )
}
