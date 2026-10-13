import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'
import WhatsAppEmbeddedSignup from '../../components/WhatsAppEmbeddedSignup'
import WhatsAppSmsConnect from '../../components/WhatsAppSmsConnect'
import SectionHelp from '../../components/Tutorial/SectionHelp'
import MigrationWizard from '../../components/MigrationWizard'
import NumberHealthCard from '../../components/NumberHealthCard'

export default function WhatsappSetupPage() {
  const router = useRouter()
  const { user, tenant, role, bots, profile, loading } = useTenant()
  const [request, setRequest] = useState(null)
  const [checkingRequest, setCheckingRequest] = useState(true)
  const [form, setForm] = useState({ business_name: '', whatsapp_number: '', contact_email: '', confirmed_available: false, notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [disconnectingId, setDisconnectingId] = useState(null)
  const [disconnectResults, setDisconnectResults] = useState({})

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  useEffect(() => {
    if (tenant && user) {
      setForm(f => ({ ...f, business_name: tenant.name || '', contact_email: user.email || '' }))
      supabase.from('whatsapp_onboarding_requests')
        .select('*').eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then(({ data }) => { setRequest(data || null); setCheckingRequest(false) })
    }
  }, [tenant, user])

  // ── Multi-número: cada bot é um número de WhatsApp com seu próprio fluxo ──
  const allBots = bots || []
  const connectedBots = allBots.filter(b => b.status === 'active' && b.phone_number_id)
  const plan = PLANS[tenant?.plan] || PLANS.free
  const subLimits = (() => { try { const sub = JSON.parse(tenant?.subscription || '{}'); return sub?.status === 'active' ? (sub.limits || {}) : {} } catch (_) { return {} } })()
  const maxNumbers = subLimits.max_bots || plan.max_bots
  const canAddNumber = connectedBots.length < maxNumbers

  async function submitRequest(e) {
    e.preventDefault()
    setError('')
    if (!form.whatsapp_number.trim()) { setError('Informe o número de WhatsApp.'); return }
    if (!form.confirmed_available) { setError('Confirme que o número não está em uso em outra conta de WhatsApp.'); return }
    setSaving(true)

    // Anti-duplicata: pedido pendente → ATUALIZA em vez de criar outro
    if (request?.status === 'pending') {
      const { data: upd, error: updErr } = await supabase.from('whatsapp_onboarding_requests')
        .update({
          business_name: form.business_name,
          whatsapp_number: form.whatsapp_number,
          contact_email: form.contact_email,
          confirmed_available: form.confirmed_available,
          notes: form.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id)
        .select('*').single()
      setSaving(false)
      if (updErr) { setError(updErr.message); return }
      setRequest(upd); setSavedAt(new Date())
      return
    }

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

  async function disconnectWhatsApp(bot) {
    if (!confirm(`⚠️ Desconectar o WhatsApp do bot "${bot.name}"?\n\nO número será desvinculado da plataforma e liberado. Você poderá:\n• Voltar para o app oficial do WhatsApp\n• Recadastrar em outra conta\n\nConversas existentes serão encerradas (não deletadas).\n\nDeseja continuar?`)) return
    setDisconnectingId(bot.id)
    setDisconnectResults(prev => ({ ...prev, [bot.id]: null }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.')
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bot_id: bot.id })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao desconectar')
      setDisconnectResults(prev => ({ ...prev, [bot.id]: { success: true, message: json.message, steps: json.results?.steps || [] } }))
      setTimeout(() => window.location.reload(), 3000)
    } catch (e) {
      setDisconnectResults(prev => ({ ...prev, [bot.id]: { success: false, message: e.message } }))
    } finally {
      setDisconnectingId(null)
    }
  }

  // Cria um novo bot (vaga de número) dentro do limite do plano

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
        Cada número de WhatsApp é um bot com seu próprio fluxo de atendimento. Você pode conectar mais de um número — o limite do seu plano é <b style={{ color: '#4f8ef7' }}>{maxNumbers > 900 ? 'ilimitado' : maxNumbers}</b>.
      </p>

      <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.05)' }}>
        <h3 style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 10, fontSize: 14 }}>❗ Antes de conectar: seu número precisa estar LIVRE</h3>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
          Um número não pode estar conectado à plataforma e logado no app do WhatsApp (comum ou Business) ao mesmo tempo. Se o número que você quer usar está num celular com WhatsApp aberto, a conexão <b style={{ color: '#e2e8f0' }}>não sai</b> — é a causa nº 1 de falha.
        </p>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Como liberar o número (sem perder nada):</p>
        <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.8 }}>
          <b style={{ color: '#10b981' }}>1. Faça o backup</b> — no app: <b>Ajustes → Conversas → Backup</b> → salvar no Google Drive. Suas conversas ficam guardadas lá.
          <br/><b style={{ color: '#10b981' }}>2. Exporte o que é crítico</b> — conversas importantes: abra a conversa → ⋮ → <b>Mais → Exportar conversa</b>. Catálogo do app: anote os produtos (você recadastra no painel e ele já vai pro catálogo oficial).
          <br/><b style={{ color: '#ef4444' }}>3. Exclua a conta daquele app</b> — <b>Ajustes → Conta → Excluir minha conta</b> → confirme. Isso só apaga a conta do app; o backup do Google Drive continua lá.
          <br/><b style={{ color: '#10b981' }}>4. Aguarde ~10 min</b> e peça a conexão aqui embaixo. O bot assume o número e o backup fica salvo caso você um dia queira voltar pro app.
        </div>
        <p style={{ color: '#64748b', fontSize: 11, marginTop: 10, marginBottom: 0 }}>
          💡 Números que nunca foram logados em nenhum WhatsApp (chip novo) conectam na hora, sem esse passo. E atenção: ao migrar, o número sai dos grupos — anote os que você participa pra pedir readmissão depois.
        </p>
      </div>

      {/* ── Números conectados: um card por bot ativo ── */}
      {connectedBots.map(bot => (
        <div key={bot.id} className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>✅ WhatsApp conectado</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Bot <b style={{ color: '#e2e8f0' }}>{bot.name}</b> ativo no número configurado.</div>
            </div>
            <button
              onClick={() => disconnectWhatsApp(bot)}
              disabled={disconnectingId === bot.id}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10, cursor: disconnectingId === bot.id ? 'not-allowed' : 'pointer',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: '#ef4444', fontSize: 13, fontWeight: 700, opacity: disconnectingId === bot.id ? 0.6 : 1,
                transition: 'all .15s',
              }}
            >
              {disconnectingId === bot.id ? '⏳ Desconectando...' : '🗑️ Desconectar WhatsApp'}
            </button>
          </div>
          {disconnectResults[bot.id] && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10,
              background: disconnectResults[bot.id].success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${disconnectResults[bot.id].success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: 13, color: disconnectResults[bot.id].success ? '#10b981' : '#ef4444',
            }}>
              {disconnectResults[bot.id].success ? '✅ ' : '❌ '}{disconnectResults[bot.id].message}
              {disconnectResults[bot.id].steps?.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {disconnectResults[bot.id].steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{s.success === false ? '❌' : s.success === true ? '✅' : '⏭️'}</span>
                      <span>{s.step}{s.error ? ': ' + s.error : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {disconnectResults[bot.id].success && <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>A página será recarregada automaticamente...</div>}
            </div>
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-soft)', color: '#64748b', fontSize: 12, lineHeight: 1.6 }}>
            💡 Ao desconectar, o número é liberado da plataforma Arkiel e pode ser usado novamente.<br/>
            <b style={{ color: '#94a3b8' }}>Prazos para reutilizar:</b><br/>
            • <b>App oficial do WhatsApp</b> — geralmente em algumas horas<br/>
            • <b>Recadastrar em outra conta de API</b> — até 24h (em casos raros, a Meta pode segurar até 30 dias)
          </div>
        </div>
      ))}

      {/* ── Saúde de cada número conectado ── */}
      {connectedBots.map(bot => <NumberHealthCard key={'h-' + bot.id} bot={bot} />)}

      <MigrationWizard activeBot={connectedBots[0]} tenantId={tenant?.id}
        step2={<>

      {/* ── Conectar novo número: o bot nasce junto com o número (1 número = 1 bot) ── */}
      {canAddNumber && (
        <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(16,185,129,0.35)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>⚡ Conectar novo número (recomendado — sem precisar de Facebook)<SectionHelp t='whatsapp-setup' s='automatica' /></h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>Digite o número, confirme o código que chega por SMS, e pronto — o bot é criado automaticamente junto com o número e fica ativo na hora.</p>
          <WhatsAppSmsConnect botId={null} businessName={tenant?.name} onConnected={() => window.location.reload()} />
        </div>
      )}

      {canAddNumber && (
        <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(24,119,242,0.25)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10, fontSize: 14 }}>📶 Prefere logar com o Facebook?<SectionHelp t='whatsapp-setup' s='facebook' /></h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>Se você já tem uma conta WhatsApp Business própria no Facebook, pode conectar direto por lá — o bot é criado junto com o número.</p>
          <WhatsAppEmbeddedSignup botId={null} onConnected={() => window.location.reload()} />
        </div>
      )}

      {!canAddNumber && (
        <div className="ark-card" style={{ marginBottom: 20, borderColor: 'rgba(245,158,11,0.35)' }}>
          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>🔒 Seu plano permite {maxNumbers > 900 ? 'números ilimitados' : `${maxNumbers} ${maxNumbers > 1 ? 'números' : 'número'}`}</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
            Você já tem {connectedBots.length} {connectedBots.length === 1 ? 'número conectado' : 'números conectados'}. Pra adicionar mais, faça upgrade do plano.
          </div>
          <a href="/admin/upgrade" className="ark-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>⬆️ Ver planos</a>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: request ? '1fr 1fr' : '1fr', gap: 20, maxWidth: 900 }}>
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 18, fontSize: 14 }}>📋 Ou preencha manualmente<SectionHelp t='whatsapp-setup' s='manual' /></h3>
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
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Volume estimado de mensagens, melhor horário de contato, etc."
                style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.confirmed_available} onChange={e => setForm(f => ({ ...f, confirmed_available: e.target.checked }))} style={{ marginTop: 3 }} />
              <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>Confirmo que esse número não está logado em nenhuma conta de WhatsApp (pessoal ou Business) no momento.</span>
            </label>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</p>}
            <button type="submit" disabled={saving} className="ark-btn">{saving ? 'Salvando...' : (request?.status === 'pending' ? 'Atualizar pedido pendente' : 'Enviar pedido')}</button>
            {savedAt && <span style={{ color: '#10b981', fontSize: 12, marginLeft: 12 }}>✅ Salvo em {savedAt.toLocaleTimeString('pt-BR')}</span>}
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
        </>}
      />

    </AdminLayout>
  )
}
