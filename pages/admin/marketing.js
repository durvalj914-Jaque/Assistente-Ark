import { useState, useEffect } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/Layout/AdminLayout'
import { supabase } from '../../lib/supabase'

/**
 * Aba Marketing — B2B cria suas mensagens de marketing e deixa prontas
 * para envio quando tiverem créditos. Compra de créditos fica na aba Upgrades.
 */
export default function MarketingPage() {
  const [tenant, setTenant] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState('viewer')
  const [credits, setCredits] = useState({ utility: 0, marketing: 0, utility_total_purchased: 0, marketing_total_purchased: 0, utility_total_used: 0, marketing_total_used: 0 })
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Templates de marketing
  const [templates, setTemplates] = useState([])
  const [showTplModal, setShowTplModal] = useState(false)
  const [editingTplId, setEditingTplId] = useState(null)
  const [tplName, setTplName] = useState('')
  const [tplText, setTplText] = useState('')
  const [savingTpl, setSavingTpl] = useState(false)
  const [tplError, setTplError] = useState('')

  // Envio
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendTplName, setSendTplName] = useState('')
  const [recipients, setRecipients] = useState('all') // 'all' | 'selected'
  const [selectedContacts, setSelectedContacts] = useState([])
  const [contacts, setContacts] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    loadSession()
  }, [])

  async function loadSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    setUser(session.user)

    const { data: tm } = await supabase
      .from('tenant_members')
      .select('role, tenants(*)')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (tm?.tenants) {
      setTenant(tm.tenants)
      setRole(tm.role || 'viewer')
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      setProfile(prof)
      await loadCredits(tm.tenants.id)
      await loadHistory(tm.tenants.id)
      await loadTemplates(tm.tenants.id)
      await loadContacts(tm.tenants.id)
    }
    setLoading(false)
  }

  async function loadCredits(tid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/credits/balance?tenant_id=${tid}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (!data.error) setCredits(data)
    } catch (e) { console.error('loadCredits:', e) }
  }

  async function loadHistory(tid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/credits/history?tenant_id=${tid}&limit=20`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const data = await res.json()
      if (!data.error) setHistory(data.usage || [])
    } catch (e) { console.error('loadHistory:', e) }
  }

  async function loadTemplates(tid) {
    try {
      const { data, error } = await supabase
        .from('marketing_messages')
        .select('*')
        .eq('tenant_id', tid)
        .order('updated_at', { ascending: false })
      if (!error) setTemplates(data || [])
      else console.error('loadTemplates:', error.message)
    } catch (e) { console.error('loadTemplates:', e) }
  }

  async function loadContacts(tid) {
    try {
      const { data, error } = await supabase.from('contacts').select('id,phone,name').eq('tenant_id', tid).limit(500)
      if (!error) setContacts(data || [])
    } catch (e) {}
  }

  // ── Templates ──
  function openNewTemplate() {
    setEditingTplId(null)
    setTplName('')
    setTplText('')
    setTplError('')
    setShowTplModal(true)
  }

  function openEditTemplate(t) {
    setEditingTplId(t.id)
    setTplName(t.name)
    setTplText(t.message)
    setTplError('')
    setShowTplModal(true)
  }

  async function saveTemplate() {
    if (!tenant || !tplName.trim() || !tplText.trim()) {
      setTplError('Preencha o nome e a mensagem.')
      return
    }
    setSavingTpl(true)
    setTplError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (editingTplId) {
        const { error } = await supabase.from('marketing_messages')
          .update({ name: tplName.trim(), message: tplText.trim(), updated_at: new Date().toISOString() })
          .eq('id', editingTplId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('marketing_messages').insert({
          tenant_id: tenant.id,
          name: tplName.trim(),
          message: tplText.trim(),
          status: 'draft',
          created_by: session?.user?.id,
        })
        if (error) throw error
      }
      setShowTplModal(false)
      await loadTemplates(tenant.id)
    } catch (e) {
      setTplError('Erro ao salvar: ' + e.message)
    }
    setSavingTpl(false)
  }

  async function deleteTemplate(id) {
    if (!confirm('Excluir esta mensagem de marketing?')) return
    try {
      await supabase.from('marketing_messages').delete().eq('id', id)
      if (tenant) await loadTemplates(tenant.id)
    } catch (e) { console.error('deleteTemplate:', e) }
  }

  // ── Envio ──
  function openSend(t) {
    setSendTplName(t?.name || '')
    setMsgText(t?.message || '')
    setRecipients('all')
    setSelectedContacts([])
    setSendResult(null)
    setShowSendModal(true)
  }

  async function handleSendMarketing() {
    if (!tenant || !msgText.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      const targetContacts = recipients === 'all' ? contacts : contacts.filter(c => selectedContacts.includes(c.id))
      const res = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          message: msgText,
          contacts: targetContacts.map(c => c.phone),
        }),
      })
      const data = await res.json()
      setSendResult(data)
      if (data.ok) {
        setShowSendModal(false)
        setMsgText('')
        await loadCredits(tenant.id)
      }
    } catch (e) {
      setSendResult({ error: e.message })
    }
    setSending(false)
  }

  if (loading) {
    return <AdminLayout><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div></AdminLayout>
  }

  const targetCount = recipients === 'all' ? contacts.length : selectedContacts.length

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <Head><title>Marketing — Assistente Ark</title></Head>

      {/* HEADER */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-soft)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>📣 Mensagens de Marketing</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Crie suas mensagens promocionais e deixe-as prontas para enviar aos seus contatos quando tiver créditos.
        </p>
      </div>

      {/* SALDO + DICA DE COMPRA */}
      <div style={{ margin: '16px 20px', padding: 16, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>📣</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saldo de marketing</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{credits.marketing} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>créditos</span></div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          Cada envio consome 1 crédito de marketing (R$0,36) por contato.<br />
          Precisa de créditos? Faça a adesão na aba <strong style={{ color: 'var(--text-primary)' }}>⬆️ Upgrades</strong>.
        </div>
      </div>

      {/* LISTA DE MENSAGENS */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>✉️ Suas mensagens prontas</h3>
          <button onClick={openNewTemplate}
            style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Nova mensagem
          </button>
        </div>

        {templates.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✉️</div>
            Nenhuma mensagem criada ainda. Clique em <strong>+ Nova mensagem</strong> para montar sua promoção e deixá-la pronta para envio.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map(t => (
              <div key={t.id} style={{ padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>✉️</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxHeight: 34, overflow: 'hidden', lineHeight: '17px' }}>
                    {t.message}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                    Atualizada em {new Date(t.updated_at || t.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => openEditTemplate(t)} title="Editar"
                    style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => openSend(t)} title="Enviar agora"
                    style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    🚀 Enviar
                  </button>
                  <button onClick={() => deleteTemplate(t.id)} title="Excluir"
                    style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTÓRICO DE USO */}
      <div style={{ padding: '0 20px 20px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>📋 Últimas conversas cobradas</h3>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
            Nenhuma conversa cobrada ainda. Quando você enviar mensagens proativas, o histórico aparecerá aqui.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{h.credit_type === 'marketing' ? '📣' : '💬'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{h.credit_type === 'marketing' ? 'Marketing' : 'Mensagem inicial'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(h.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>R$ {parseFloat(h.cost_brl).toFixed(4)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: NOVA/EDITAR MENSAGEM */}
      {showTplModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowTplModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{editingTplId ? '✏️ Editar mensagem' : '✉️ Nova mensagem de marketing'}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              A mensagem fica salva e pronta. Você envia quando quiser — cada contato que receber consumirá 1 crédito de marketing.
            </p>

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Nome interno</label>
            <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Ex: Promoção de inverno"
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, marginTop: 6, marginBottom: 16 }} />

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Mensagem</label>
            <textarea value={tplText} onChange={e => setTplText(e.target.value)} placeholder="Ex: Olá! Aproveite nossa promoção desta semana..." rows={6}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', marginTop: 6, marginBottom: 16 }} />

            {tplError && (
              <div style={{ padding: 12, background: '#fef2f2', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>❌ {tplError}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowTplModal(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveTemplate} disabled={savingTpl}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: savingTpl ? 'not-allowed' : 'pointer', opacity: savingTpl ? 0.6 : 1 }}>
                {savingTpl ? 'Salvando...' : '💾 Salvar mensagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENVIAR MARKETING */}
      {showSendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setShowSendModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🚀 Enviar mensagem de marketing</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {sendTplName ? `Enviando: "${sendTplName}". ` : ''}Cada contato que receber consumirá 1 crédito de marketing (R$0,36). Você tem {credits.marketing} créditos.
            </p>

            {/* Destinatários */}
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Destinatários</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setRecipients('all')} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${recipients === 'all' ? '#4f8ef7' : 'var(--border-soft)'}`, background: recipients === 'all' ? 'var(--blue-tint)' : 'var(--bg-secondary)', color: recipients === 'all' ? '#4f8ef7' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Todos ({contacts.length})
              </button>
              <button onClick={() => setRecipients('selected')} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${recipients === 'selected' ? '#4f8ef7' : 'var(--border-soft)'}`, background: recipients === 'selected' ? 'var(--blue-tint)' : 'var(--bg-secondary)', color: recipients === 'selected' ? '#4f8ef7' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Selecionar
              </button>
            </div>

            {recipients === 'selected' && (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-soft)', borderRadius: 8, marginBottom: 12 }}>
                {contacts.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }}>
                    <input type="checkbox" checked={selectedContacts.includes(c.id)} onChange={e => {
                      if (e.target.checked) setSelectedContacts([...selectedContacts, c.id])
                      else setSelectedContacts(selectedContacts.filter(id => id !== c.id))
                    }} />
                    <span style={{ fontSize: 13 }}>{c.name || c.phone}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Mensagem (editável na hora do envio) */}
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Mensagem</label>
            <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={5}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', marginBottom: 12 }} />

            {/* Resumo de custos */}
            <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Destinatários</span>
                <span>{targetCount} contatos</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Créditos necessários</span>
                <span style={{ fontWeight: 600 }}>{targetCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Custo total</span>
                <span>R$ {(targetCount * 0.36).toFixed(2)}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Seu saldo</span>
                <span style={{ color: credits.marketing >= targetCount ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {credits.marketing} créditos {credits.marketing >= targetCount ? '✅' : '⚠️ insuficiente — compre na aba Upgrades'}
                </span>
              </div>
            </div>

            {sendResult?.error && (
              <div style={{ padding: 12, background: '#fef2f2', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>❌ {sendResult.error}</div>
            )}
            {sendResult?.ok && (
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 10, fontSize: 13, color: '#15803d', marginBottom: 12 }}>
                ✅ {sendResult.sent || sendResult.queued} mensagens enviadas! Créditos debitados.
              </div>
            )}

            <button onClick={handleSendMarketing} disabled={sending || !msgText.trim() || credits.marketing < targetCount}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: (sending || !msgText.trim() || credits.marketing < targetCount) ? 'not-allowed' : 'pointer', opacity: (sending || !msgText.trim() || credits.marketing < targetCount) ? 0.5 : 1 }}>
              {sending ? 'Enviando...' : `🚀 Enviar para ${targetCount} contato(s)`}
            </button>

            <button onClick={() => setShowSendModal(false)} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 12 }}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
