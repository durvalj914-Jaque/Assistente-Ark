import { useState } from 'react'
import { supabase } from '../lib/supabase'

// ── LGPD: consentimento explícito no primeiro acesso ──
// Aparece uma única vez, quando profile.consent_accepted_at é nulo.
// O aceite fica registrado com data/hora na tabela profiles (prova de consentimento).
export default function ConsentModal({ profile, user, onAccept }) {
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!profile || !user || profile.consent_accepted_at || done) return null

  async function accept() {
    if (!checked || saving) return
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ consent_accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (err) { setError('Não foi possível registrar o aceite. Verifique sua conexão e tente de novo.'); setSaving(false); return }
    setSaving(false)
    setDone(true)
    if (onAccept) onAccept()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card, #141414)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
        maxWidth: '520px', width: '100%', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        maxHeight: '90dvh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: '26px', marginBottom: '10px' }}>🔐</div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 10px' }}>Bem-vindo(a) ao Assistente Ark!</h2>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px' }}>
          Antes de começar, você precisa conhecer e concordar com os termos que regem o uso da plataforma
          e com a forma como tratamos dados pessoais (seus e dos contatos que conversam com seus bots),
          conforme a Lei Geral de Proteção de Dados (LGPD).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 18px' }}>
          <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontSize: '14px', textDecoration: 'none' }}>📄 Termos de Uso — abrir</a>
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontSize: '14px', textDecoration: 'none' }}>🔒 Política de Privacidade — abrir</a>
        </div>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', margin: '0 0 18px', fontSize: '13.5px', lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: '2px', accentColor: '#25D366', width: '17px', height: '17px' }} />
          <span>Li e concordo com os <strong>Termos de Uso</strong> e a <strong>Política de Privacidade</strong>, incluindo o tratamento de dados conforme a LGPD.</span>
        </label>
        {error && <p style={{ color: '#ff6b6b', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
        <button onClick={accept} disabled={!checked || saving} style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none', cursor: !checked || saving ? 'not-allowed' : 'pointer',
          background: checked ? '#25D366' : 'rgba(255,255,255,0.12)', color: checked ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
          fontSize: '14px', fontWeight: 700, transition: 'all .15s',
        }}>
          {saving ? 'Registrando...' : 'Aceitar e continuar'}
        </button>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '12px 0 0', textAlign: 'center' }}>
          Seu aceite fica registrado com data e hora. Você pode solicitar a exclusão a qualquer momento via arkieltech@gmail.com.
        </p>
      </div>
    </div>
  )
}
