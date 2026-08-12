import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import WhatsAppEmbeddedSignup from '../../components/WhatsAppEmbeddedSignup'
import WhatsAppSmsConnect from '../../components/WhatsAppSmsConnect'

export default function WhatsappSetupPage() {
  const router = useRouter()
  const { user, tenant, role, bots, profile, loading } = useTenant()
  const [request, setRequest] = useState(null)
  const [checkingRequest, setCheckingRequest] = useState(true)
  const [form, setForm] = useState({ business_name: '', whatsapp_number: '', contact_email: '', confirmed_available: false, notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectResult, setDisconnectResult] = useState(null)

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  useEffect(() => {
    if (tenant && user) {
      setForm(f => ({ ...f, business_name: tenant.name || '', contact_email: user.email || '' }))
      supabase.from('whatsapp_onboarding_requests')
        .select('*').eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => { setRequest(data || null); setCheckingRequest(false) })
    }
  }, [tenant, user])

  const activeBot = bots?.find(b => b.status === 'active' && b.phone_number_id)

  async function submitRequest(e) {
    e.preventDefault()
    setError('')
    if (!form.whatsapp_number.trim()) { setError('Informe o número de WhatsApp.'); return }
    if (!form.confirmed_available) { setError('Confirme que o número não está em uso em outra conta de WhatsApp.'); return }
    setSaving(true)
    const { data, error: insErr } = await supabase.from('whatsapp_onboarding_requests').insert({
      tenant_id: tenant.id,
      requested_by: user.id,
      business_name: form.business_name,
      whatsapp_number: form.whatsapp_number,
      contact_email: form.contact_email,
      confirmed_available: form.confirmed_available,
      notes: form.notes,
      status: 'pending'
    }).select('*').single()
    setSaving(false)
    if (insErr) { setError('Não foi possível enviar. Tente novamente em instantes.'); return }
    setRequest(data)
  }

  async function disconnectWhatsApp() {
    if (!activeBot) return
    if (!confirm('⚠️ Desconectar o WhatsApp?\n\nO número será desvinculado da plataforma e liberado. Você poderá:\n• Voltar para o app oficial do WhatsApp\n• Recadastrar em outra conta\n\nConversas existentes serão encerradas (não deletadas).\n\nDeseja continuar?')) return
    setDisconnecting(true)
    setDisconnectResult(null)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bot_id: activeBot.id })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao desconectar')
      setDisconnectResult({ success: true, message: json.message, steps: json.results?.steps || [] })
      // Reload after 3s to show disconnected state
      setTimeout(() => window.location.reload(), 3000)
    } catch (e) {
      console.error('[disconnect]', e)
      setDisconnectResult({ success: false, message: e.message })
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading || !user || !tenant || checkingRequest) return null

  const label = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }
  const statusMap = {
    pending:     { label: '⏳ Recebido — aguardando nossa equipe',     color: '#f59e0b' },
    in_progress: { label: '⚙️ Em configuração pela nossa equipe',      color: '#4f8ef7' },
    connected:   { label: '✅ Conectado',                              color: '#10b981' },
    rejected:    { label: '⚠️ Precisa de ajuste — veja a observação',  color: '#ef4444' },
  }

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>📱 Conectar WhatsApp</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, maxWidth: 640 }}>
        Pra ativar seu bot, precisamos transformar um número de WhatsApp em conta Business API. Preencha os dados abaixo e nossa equipe finaliza a configuração junto à Meta.
      </p>

      {activeBot && (
        <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>✅ WhatsApp já conectado</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Bot <b style={{ color: '#e2e8f0' }}>{activeBot.name}</b> ativo no número configurado.</div>
            </div>
            <button
              onClick={disconnectWhatsApp}
              disabled={disconnecting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10, cursor: disconnecting ? 'not-allowed' : 'pointer',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: '#ef4444', fontSize: 13, fontWeight: 700, opacity: disconnecting ? 0.6 : 1,
                transition: 'all .15s',
              }}
            >
              {disconnecting ? '⏳ Desconectando...' : '🗑️ Desconectar WhatsApp'}
            </button>
          </div>
          {disconnectResult && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10,
              background: disconnectResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${disconnectResult.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: 13, color: disconnectResult.success ? '#10b981' : '#ef4444',
            }}>
              {disconnectResult.success ? '✅ ' : '❌ '}{disconnectResult.message}
              {disconnectResult.steps?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {disconnectResult.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{s.success === false ? '❌' : s.success === true ? '✅' : '⏭️'}</span>
                      <span>{s.step}{s.error ? ': ' + s.error : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {disconnectResult.success && <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>A página será recarregada automaticamente...</div>}
            </div>
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)', color: '#64748b', fontSize: 12 }}>
            💡 Ao desconectar, o número é liberado da plataforma Arkiel e pode ser usado novamente no app oficial do WhatsApp ou recadastrado em outra conta.
          </div>
        </div>
      )}

      {!activeBot && bots?.[0] && (
        <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(16,185,129,0.35)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>⚡ Conexão automática (recomendado — sem precisar de Facebook)</h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>Digite seu número, confirme o código que chega por SMS, e pronto — seu bot fica ativo na hora, sem precisar de conta Facebook.</p>
          <WhatsAppSmsConnect botId={bots[0].id} businessName={tenant?.name} onConnected={() => window.location.reload()} />
        </div>
      )}

      {!activeBot && bots?.[0] && (
        <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(24,119,242,0.25)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>📶 Prefere logar com o Facebook?</h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>Se você já tem uma conta WhatsApp Business própria no Facebook, pode conectar direto por lá.</p>
          <WhatsAppEmbeddedSignup botId={bots[0].id} onConnected={() => window.location.reload()} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: request ? '1fr 1fr' : '1fr', gap: 20, maxWidth: 900 }}>
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>📋 Ou preencha manualmente</h3>
          <form onSubmit={submitRequest}>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>NOME DA EMPRESA</label>
              <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} className="ark-input" required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>NÚMERO DE WHATSAPP (COM DDD)</label>
              <input value={form.whatsapp_number} onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                placeholder="Ex: 11 91234-5678" className="ark-input" required />
              <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>ℹ️ Precisa ser um número que ainda NÃO esteja ativo no app do WhatsApp comum ou Business normal — ele será migrado exclusivamente pra API oficial.</p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>E-MAIL DE REFERÊNCIA</label>
              <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="ark-input" required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>OBSERVAÇÕES (OPCIONAL)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Volume estimado de mensagens, melhor horário de contato, etc."
                style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.confirmed_available} onChange={e => setForm(f => ({ ...f, confirmed_available: e.target.checked }))} style={{ marginTop: 3 }} />
              <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>Confirmo que esse número não está logado em nenhuma conta de WhatsApp (pessoal ou Business) no momento.</span>
            </label>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</p>}
            <button type="submit" disabled={saving} className="ark-btn">{saving ? 'Enviando...' : (request ? 'Enviar novo pedido' : 'Enviar pedido')}</button>
          </form>
        </div>

        {request && (
          <div className="ark-card">
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>📨 Último pedido enviado</h3>
            <div style={{ marginBottom: 10 }}>
              <span className="ark-badge" style={{ background: (statusMap[request.status]?.color || '#4f8ef7') + '22', color: statusMap[request.status]?.color || '#4f8ef7', border: '1px solid transparent' }}>
                {statusMap[request.status]?.label || request.status}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Número: <b style={{ color: '#e2e8f0' }}>{request.whatsapp_number}</b></div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>E-mail: <b style={{ color: '#e2e8f0' }}>{request.contact_email}</b></div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Enviado em: <b style={{ color: '#e2e8f0' }}>{new Date(request.created_at).toLocaleString('pt-BR')}</b></div>
            {request.admin_notes && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#12121f', borderRadius: 8, color: '#cbd5e1', fontSize: 12 }}>
                💬 {request.admin_notes}
              </div>
            )}
            <p style={{ color: '#334155', fontSize: 11, marginTop: 16 }}>Normalmente configuramos em até 24h úteis. Qualquer dúvida, fale com a gente pelo WhatsApp +55 11 91375-1590.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
