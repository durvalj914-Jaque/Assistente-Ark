import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'
import HelpTip from '../HelpTip'

export default function NewClientModal({ onClose, onCreated }) {
  const [companyName, setCompanyName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function create() {
    if (!companyName.trim() || !ownerEmail.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ company_name: companyName, owner_email: ownerEmail, plan }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erro ao criar cliente')
      setResult(data)
      onCreated?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 460, maxWidth: '100%' }}>

        {result ? (
          <>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 14, fontSize: 15 }}>✅ Cliente criado!</h3>
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6 }}>
              <b style={{ color: '#e2e8f0' }}>{result.tenant.name}</b> foi criado no plano <b style={{ color: '#e2e8f0' }}>{PLANS[result.tenant.plan]?.label}</b>, com um bot padrão pronto.
              {result.linked_existing ? (
                <> Esse e-mail já tinha conta no Assistente Ark — já foi vinculado direto como dono(a).</>
              ) : (
                <> Assim que <b style={{ color: '#e2e8f0' }}>{ownerEmail}</b> entrar em arkiel.com.br com login do Google, a conta já vai estar pronta e vinculada automaticamente — nada pra ele(a) configurar antes.</>
              )}
            </div>
            <button onClick={onClose} className="ark-btn" style={{ width: '100%' }}>Fechar</button>
          </>
        ) : (
          <>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 15 }}>+ Novo Cliente</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 18, lineHeight: 1.5 }}>
              Deixa a conta pronta antes do cliente entrar — ideal pra venda direta/offline.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center' }}>
                NOME DA EMPRESA
                <HelpTip text="Como o cliente vai ver o nome da conta dele no painel. Dá pra editar depois em Configurações." />
              </label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Clínica Sorriso Feliz" className="ark-input" style={{ marginTop: 6 }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center' }}>
                E-MAIL GOOGLE DO RESPONSÁVEL
                <HelpTip text="O e-mail que a pessoa vai usar pra fazer login (precisa ser uma conta Google). Quando ela entrar com esse e-mail, cai direto nessa conta — sem precisar de nada configurado antes." />
              </label>
              <input value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="dono@empresacliente.com" className="ark-input" style={{ marginTop: 6 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center' }}>
                PLANO INICIAL
                <HelpTip text="Define quantos bots e mensagens/mês o cliente pode usar. Dá pra mudar a qualquer momento depois, em Gerenciar." />
              </label>
              <select value={plan} onChange={e => setPlan(e.target.value)} className="ark-input" style={{ marginTop: 6 }}>
                {Object.entries(PLANS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
              </select>
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 14 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={create} disabled={loading || !companyName.trim() || !ownerEmail.trim()}
                className="ark-btn" style={{ flex: 1, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Criando…' : 'Criar cliente'}
              </button>
              <button onClick={() => !loading && onClose()} className="ark-btn-ghost">Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
