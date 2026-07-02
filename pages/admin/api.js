import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function ApiPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [apiKey, setApiKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => { if (tenant) setApiKey(tenant.api_key || '') }, [tenant])

  async function regenerate() {
    if (!confirm('Isso vai invalidar a chave atual. Qualquer integração usando a chave antiga vai parar de funcionar. Continuar?')) return
    setRegenerating(true)
    const newKey = 'ark_live_' + crypto.randomUUID().replace(/-/g, '')
    const { error } = await supabase.from('tenants').update({ api_key: newKey }).eq('id', tenant.id)
    setRegenerating(false)
    if (!error) setApiKey(newKey)
  }

  function copyKey() {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !user || !tenant) return null

  const snippet = `curl -X POST https://arkiel.com.br/api/v1/send \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "5511999999999", "message": "Olá! Essa mensagem veio pela API."}'`

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>🔌 API</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, maxWidth: 640 }}>
        Use sua chave pra enviar mensagens de WhatsApp pelo bot ativo da sua empresa a partir de qualquer sistema seu.
      </p>

      <div style={{ display: 'grid', gap: 20, maxWidth: 700 }}>
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>🔑 Sua chave de API</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={apiKey} className="ark-input" style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <button onClick={copyKey} className="ark-btn" style={{ whiteSpace: 'nowrap' }}>{copied ? '✅ Copiado' : 'Copiar'}</button>
          </div>
          {(role === 'owner' || role === 'admin') && (
            <button onClick={regenerate} disabled={regenerating}
              style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {regenerating ? 'Gerando...' : '🔄 Gerar nova chave'}
            </button>
          )}
        </div>

        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>📘 Como usar</h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Envie um POST pra <code style={{ color: '#4f8ef7' }}>/api/v1/send</code> com sua chave no cabeçalho <code style={{ color: '#4f8ef7' }}>Authorization</code>:</p>
          <pre style={{ background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, padding: 14, color: '#cbd5e1', fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{snippet}</pre>
          <p style={{ color: '#334155', fontSize: 11, marginTop: 10 }}>A mensagem sai pelo primeiro bot ativo da sua conta e aparece normalmente em Conversas.</p>
        </div>
      </div>
    </AdminLayout>
  )
}
