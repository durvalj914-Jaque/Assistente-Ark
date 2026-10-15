import { useEffect, useState } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'

/**
 * /admin/2fa — Configuração do 2FA (TOTP) do platform admin.
 * Disponível só para is_platform_admin (o nav só mostra para eles).
 * Fluxo: setup (QR + segredo) → confirm (primeiro código) → ativo.
 */
export default function TwoFactorPage() {
  const { user, tenant, role, profile, loading } = useTenant()
  const [enabled, setEnabled] = useState(null) // null = carregando
  const [secret, setSecret] = useState('')
  const [otpauth, setOtpauth] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [disableCode, setDisableCode] = useState('')

  async function api(body) {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify(body),
    })
    return { ok: r.ok, data: await r.json().catch(() => ({})) }
  }

  async function load() {
    try {
      // O estado atual chega pela colagem: se o gate do /painel já conhece o
      // profile, usamos ele; o valor autoritativo vem do confirm/disable.
      setEnabled(profile?.totp_enabled ? true : false)
    } catch (_) {}
  }
  useEffect(() => { if (profile) load() }, [profile?.totp_enabled])

  async function setup() {
    setBusy(true); setErr(''); setMsg('')
    const r = await api({ action: 'setup' })
    if (!r.ok) { setErr(r.data.error || 'Erro ao gerar segredo'); setBusy(false); return }
    setSecret(r.data.secret); setOtpauth(r.data.otpauth)
    setMsg('Abra seu app autenticador (Google Authenticator, 1Password, Authy...) e adicione a conta escaneando o QR code ou digitando o código abaixo. Depois confirme com o código de 6 dígitos.')
    setBusy(false)
  }

  async function confirm() {
    setBusy(true); setErr('')
    const r = await api({ action: 'confirm', code })
    if (!r.ok) { setErr(r.data.error || 'Código inválido'); setBusy(false); return }
    setEnabled(true); setSecret(''); setOtpauth(''); setCode(''); setMsg('✅ 2FA ativado! O console Arkiel (/painel) agora pede o código a cada sessão.')
    setBusy(false)
  }

  async function disable() {
    setBusy(true); setErr('')
    const r = await api({ action: 'disable', code: disableCode })
    if (!r.ok) { setErr(r.data.error || 'Código inválido'); setBusy(false); return }
    setEnabled(false); setDisableCode(''); setMsg('2FA desativado.')
    setBusy(false)
  }

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <div style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>🔐 Segurança 2FA</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 1.6 }}>
          Segunda etapa de autenticação para o console Arkiel. Protege o acesso aos dados de todos os clientes
          da plataforma, exigindo um código do seu celular em cada sessão. Recomendado pela LGPD (art. 46).
        </p>

        {err && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{err}</div>}
        {msg && <div style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>{msg}</div>}

        {enabled === null ? <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Carregando...</p> : enabled ? (
          <div style={{ border: '1px solid rgba(37,211,102,0.3)', background: 'rgba(37,211,102,0.05)', borderRadius: 14, padding: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#25D366' }}>✅ 2FA ativo</div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 16, lineHeight: 1.5 }}>
              O console Arkiel pede seu código de 6 dígitos uma vez por sessão do navegador.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Código para desativar" inputMode="numeric" style={{ flex: 1, minWidth: 160, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 15, letterSpacing: 2 }} />
              <button onClick={disable} disabled={busy || disableCode.length !== 6} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', fontSize: 13.5, fontWeight: 700 }}>Desativar</button>
            </div>
          </div>
        ) : secret ? (
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 22, background: 'rgba(255,255,255,0.03)' }}>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 14, lineHeight: 1.5 }}>
              1️⃣ Adicione no app autenticador escaneando o QR ou digitando o código:
            </p>
            <div style={{ fontFamily: 'monospace', fontSize: 15, letterSpacing: 2, background: 'rgba(0,0,0,0.4)', padding: '12px 14px', borderRadius: 10, marginBottom: 8, wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.1)' }}>{secret}</div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginBottom: 18, lineHeight: 1.5 }}>
              No app: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>+ Adicionar conta → Entrar com chave de configuração</strong> — conta "Assistente Ark", provedor "Baseada em tempo (TOTP)", cole o código acima.
              O segredo é gerado no seu navegador-servidor e não sai da plataforma.
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>2️⃣ Digite o código de 6 dígitos do app para confirmar:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" style={{ flex: 1, minWidth: 140, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 20, letterSpacing: 4, textAlign: 'center' }} />
              <button onClick={confirm} disabled={busy || code.length !== 6} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: code.length === 6 ? '#25D366' : 'rgba(255,255,255,0.12)', color: code.length === 6 ? '#0a0a0a' : 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 700 }}>Ativar 2FA</button>
            </div>
          </div>
        ) : (
          <button onClick={setup} disabled={busy} style={{ padding: '14px 28px', borderRadius: 12, border: 'none', cursor: 'pointer', background: '#25D366', color: '#0a0a0a', fontSize: 15, fontWeight: 700 }}>
            {busy ? 'Gerando...' : 'Ativar 2FA no meu acesso'}
          </button>
        )}
      </div>
    </AdminLayout>
  )
}
