import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'
import HelpTip from '../HelpTip'

function ManageForm({ client, onDone }) {
  const bot = client.bots?.[0]
  const [plan, setPlan] = useState(client.plan)
  const [phoneId, setPhoneId] = useState(bot?.phone_number_id || '')
  const [wabaId, setWabaId] = useState(bot?.waba_id || '')
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function call(body) {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/admin/update-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ tenant_id: client.id, ...body }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Erro')
    return data
  }

  async function savePlan() {
    setSaving(true); setMsg('')
    try { await call({ plan }); setMsg('✅ Plano atualizado'); onDone() }
    catch (e) { setMsg('❌ ' + e.message) }
    finally { setSaving(false) }
  }

  async function connectWhatsapp() {
    if (!bot) { setMsg('❌ Esse cliente ainda não tem bot (não deveria acontecer, avise o suporte técnico)'); return }
    if (!phoneId || !token) { setMsg('❌ Preencha ao menos o Phone Number ID e o Access Token'); return }
    setSaving(true); setMsg('')
    try {
      await call({ bot_id: bot.id, phone_number_id: phoneId, waba_id: wabaId, access_token: token })
      setMsg('✅ WhatsApp conectado — bot ativado')
      onDone()
    } catch (e) { setMsg('❌ ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          PLANO <HelpTip text="Define quantos bots e mensagens/mês esse cliente pode usar." />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="ark-input" style={{ fontSize: 12, maxWidth: 200 }}>
            {Object.entries(PLANS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
          </select>
          <button disabled={saving} onClick={savePlan} className="ark-btn" style={{ fontSize: 12, padding: '8px 14px' }}>Salvar plano</button>
        </div>
      </div>

      <div>
        <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          CONECTAR WHATSAPP {bot?.phone_number_id && <span style={{ color: '#10b981', marginLeft: 8, fontWeight: 400 }}>já conectado</span>}
          <HelpTip text="Os 3 dados que a Meta te dá quando o número do cliente é aprovado na API oficial do WhatsApp Business. Preencher aqui ativa o bot dele na hora." />
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={phoneId} onChange={e => setPhoneId(e.target.value)} placeholder="Phone Number ID (Meta)" className="ark-input" style={{ fontSize: 12 }} />
          <input value={wabaId} onChange={e => setWabaId(e.target.value)} placeholder="WABA ID" className="ark-input" style={{ fontSize: 12 }} />
        </div>
        <input value={token} onChange={e => setToken(e.target.value)} placeholder="Access Token permanente" className="ark-input" style={{ fontSize: 12, marginBottom: 8 }} />
        <button disabled={saving} onClick={connectWhatsapp} className="ark-btn" style={{ fontSize: 12, padding: '8px 14px', background: 'linear-gradient(135deg,#10b981,#059669)' }}>⚡ Conectar bot agora</button>
      </div>

      {msg && <p style={{ fontSize: 12, color: msg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{msg}</p>}
    </div>
  )
}

export default function ClientCard({ client, onChanged }) {
  const [open, setOpen] = useState(false)
  const plan = PLANS[client.plan] || PLANS.free
  const bot = client.bots?.[0]
  const owners = (client.members || []).filter(m => m.role === 'owner')
  const pending = client.pending_invites || []

  return (
    <div className="ark-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{client.name}</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            {owners.length > 0 ? (
              owners.map(o => o.profiles?.email).join(', ')
            ) : pending.length > 0 ? (
              <span style={{ color: '#f59e0b' }}>⏳ convite pendente: {pending.map(p => p.email).join(', ')}</span>
            ) : (
              <span style={{ color: '#475569' }}>sem responsável vinculado ainda</span>
            )}
          </div>
          <div style={{ color: '#334155', fontSize: 11, marginTop: 6 }}>
            criado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
            {bot ? (
              bot.phone_number_id ? <span style={{ color: '#10b981' }}> · 🟢 WhatsApp conectado</span> : <span style={{ color: '#f59e0b' }}> · 🟡 sem WhatsApp ainda</span>
            ) : <span style={{ color: '#ef4444' }}> · ⚠️ sem bot</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ark-badge" style={{ background: 'rgba(79,142,247,0.1)', color: '#4f8ef7', border: '1px solid transparent', whiteSpace: 'nowrap' }}>{plan.label}</span>
          <button onClick={() => setOpen(o => !o)} className="ark-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>{open ? 'Fechar' : 'Gerenciar'}</button>
        </div>
      </div>
      {open && <ManageForm client={client} onDone={onChanged} />}
    </div>
  )
}
