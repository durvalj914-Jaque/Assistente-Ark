import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Conexão de WhatsApp 100% automática e sem precisar de conta Facebook:
 * o cliente digita o número, recebe um código por SMS, confirma — pronto.
 * A Arkiel adiciona o número na própria WABA (Business Manager da Arkiel)
 * usando um token de servidor que nunca é exposto ao cliente.
 */
export default function WhatsAppSmsConnect({ botId, businessName, onConnected }) {
  const [step, setStep] = useState('phone') // 'phone' | 'code'
  const [cc, setCc] = useState('55')
  const [phone, setPhone] = useState('')
  const [verifiedName, setVerifiedName] = useState(businessName || '')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
  }

  async function sendCode(e) {
    e.preventDefault()
    setError('')
    if (!phone.trim() || !verifiedName.trim()) { setError('Preencha o número e o nome do negócio.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/add-number', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ bot_id: botId, cc, phone_number: phone.replace(/\D/g, ''), verified_name: verifiedName })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao adicionar o número')
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmCode(e) {
    e.preventDefault()
    setError('')
    if (!code.trim()) { setError('Informe o código recebido por SMS.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/confirm-number', {
        method: 'POST', headers: await authHeader(),
        body: JSON.stringify({ bot_id: botId, code: code.trim() })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao confirmar o código')
      onConnected && onConnected()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }
  const label = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }

  if (step === 'code') {
    return (
      <form onSubmit={confirmCode}>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>📩 Enviamos um SMS com um código de 6 dígitos pro número informado. Digite ele abaixo:</p>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>CÓDIGO RECEBIDO</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" style={inputStyle} maxLength={8} />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</p>}
        <button type="submit" disabled={loading} className="ark-btn">{loading ? 'Confirmando...' : 'Confirmar código'}</button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 70 }}>
          <label style={label}>DDI</label>
          <input value={cc} onChange={e => setCc(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>NÚMERO (DDD + NÚMERO)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11912345678" style={inputStyle} />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>NOME DO NEGÓCIO (aparece pro cliente final)</label>
        <input value={verifiedName} onChange={e => setVerifiedName(e.target.value)} style={inputStyle} />
      </div>
      <p style={{ color: '#334155', fontSize: 11, marginBottom: 14 }}>ℹ️ O número precisa estar livre de qualquer conta WhatsApp (comum ou Business) e conseguir receber SMS.</p>
      {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</p>}
      <button type="submit" disabled={loading} className="ark-btn">{loading ? 'Enviando...' : 'Enviar código por SMS'}</button>
    </form>
  )
}
