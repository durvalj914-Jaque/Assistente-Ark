import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'
import HelpTip from '../HelpTip'

export default function NewClientModal({ onClose, onCreated }) {
  const [companyName, setCompanyName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [plan, setPlan] = useState('free')
  const [whatsappCc, setWhatsappCc] = useState('55')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [whatsappName, setWhatsappName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [smsCode, setSmsCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  async function create() {
    if (!companyName.trim() || !ownerEmail.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const body = {
        company_name: companyName,
        owner_email: ownerEmail,
        plan,
      }

      const digitsOnly = (s) => (s || '').replace(/\D/g, '')
      const cc = digitsOnly(whatsappCc)
      const num = digitsOnly(whatsappNumber)
      if (cc && num) {
        body.whatsapp_cc = cc
        body.whatsapp_number = num
        body.whatsapp_name = whatsappName.trim() || companyName.trim()
      }

      const r = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify(body),
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

  async function confirmCode() {
    if (!smsCode.trim() || smsCode.trim().length < 6) return
    setConfirming(true)
    setConfirmError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/admin/confirm-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ bot_id: result.whatsapp.bot_id, code: smsCode.trim() }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erro ao confirmar código')
      setConfirmed(true)
    } catch (e) {
      setConfirmError(e.message)
    } finally {
      setConfirming(false)
    }
  }

  // Helper pra saber se o WhatsApp foi cadastrado e tá aguardando SMS
  const awaitingSms = result?.whatsapp?.sms_sent && !confirmed

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && !loading && !confirming && onClose()}>
      <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        {result ? (
          <>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 14, fontSize: 15 }}>
              {confirmed ? '✅ Cliente pronto e WhatsApp ativo!' : '✅ Cliente criado!'}
            </h3>

            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6 }}>
              <b style={{ color: '#e2e8f0' }}>{result.tenant.name}</b> foi criado no plano <b style={{ color: '#e2e8f0' }}>{PLANS[result.tenant.plan]?.label}</b>, com um bot padrão pronto.
              {result.linked_existing ? (
                <> Esse e-mail já tinha conta no Assistente Ark — já foi vinculado direto como dono(a).</>
              ) : (
                <> Assim que <b style={{ color: '#e2e8f0' }}>{ownerEmail}</b> entrar em arkiel.com.br com login do Google, a conta já vai estar pronta e vinculada automaticamente.</>
              )}
            </div>

            {/* Status do WhatsApp */}
            {result.whatsapp && (
              <>
                {/* Confirmação bem-sucedida */}
                {confirmed && (
                  <div style={{
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.4)',
                    borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: '#10b981', lineHeight: 1.6
                  }}>
                    🎉 <b>WhatsApp ativado!</b> O número <b>{result.whatsapp.display_number}</b> está registrado, conectado e o bot já está ativo.
                    <br/>Pode testar mandando uma mensagem agora mesmo.
                  </div>
                )}

                {/* Aguardando SMS — campo de confirmação na hora */}
                {awaitingSms && (
                  <div style={{
                    background: 'rgba(6,182,212,0.08)',
                    border: '1px solid rgba(6,182,212,0.3)',
                    borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6
                  }}>
                    📱 <b style={{ color: '#e2e8f0' }}>SMS enviado!</b> O número <b style={{ color: '#e2e8f0' }}>{result.whatsapp.display_number}</b> recebeu um código de 6 dígitos.
                    <br/><br/>
                    <b style={{ color: '#06b6d4' }}>Peça o código pro cliente</b> e digite aqui pra ativar o bot agora:
                  </div>
                )}

                {/* Campo de input do código SMS */}
                {awaitingSms && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        value={smsCode}
                        onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={e => e.key === 'Enter' && smsCode.trim().length >= 6 && confirmCode()}
                        placeholder="000000"
                        maxLength={6}
                        style={{
                          flex: 1, background: '#12121f', border: '1px solid rgba(6,182,212,0.25)',
                          borderRadius: 8, color: '#fff', padding: '12px 16px', fontSize: 22,
                          fontFamily: 'monospace', letterSpacing: 8, textAlign: 'center', outline: 'none',
                        }}
                      />
                      <button
                        onClick={confirmCode}
                        disabled={confirming || smsCode.trim().length < 6}
                        className="ark-btn"
                        style={{ opacity: confirming || smsCode.trim().length < 6 ? 0.6 : 1, padding: '12px 20px', whiteSpace: 'nowrap' }}
                      >
                        {confirming ? 'Confirmando…' : 'Ativar'}
                      </button>
                    </div>
                    {confirmError && (
                      <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{confirmError}</p>
                    )}
                    <span style={{ color: '#334155', fontSize: 10.5, marginTop: 6, display: 'block' }}>
                      O código expira em alguns minutos. Se não chegou, pode reenviar pelo portal do cliente.
                    </span>
                  </div>
                )}

                {/* WhatsApp falhou */}
                {!result.whatsapp.sms_sent && !confirmed && (
                  <div style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.6
                  }}>
                    ⚠️ <b style={{ color: '#e2e8f0' }}>WhatsApp:</b> {result.whatsapp.error}
                    <br/>O cliente pode ativar o número pelo portal (arkiel.com.br/client).
                  </div>
                )}
              </>
            )}

            {result.warning && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#f59e0b' }}>
                ⚠️ {result.warning}
              </div>
            )}

            <button
              onClick={onClose}
              className="ark-btn"
              style={{ width: '100%' }}
              disabled={confirming}
            >
              {confirmed ? 'Fechar' : awaitingSms ? 'Confirmar depois' : 'Fechar'}
            </button>
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

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center' }}>
                PLANO INICIAL
                <HelpTip text="Define quantos bots e mensagens/mês o cliente pode usar. Dá pra mudar a qualquer momento depois, em Gerenciar." />
              </label>
              <select value={plan} onChange={e => setPlan(e.target.value)} className="ark-input" style={{ marginTop: 6 }}>
                {Object.entries(PLANS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
              </select>
            </div>

            {/* Separador */}
            <div style={{ borderTop: '1px solid rgba(79,142,247,0.12)', margin: '18px 0', paddingTop: 18 }}>
              <label style={{ color: '#06b6d4', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                📱 WHATSAPP (OPCIONAL)
                <HelpTip text="Se você já tem o número do cliente, pode cadastrar agora. O sistema adiciona o número na WABA da Arkiel e manda um SMS com código de verificação pro cliente. Como você tá junto com ele, é só pedir o código e digitar aqui mesmo — o bot ativa na hora." />
              </label>
              <p style={{ color: '#475569', fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
                Preencha se quiser já ativar o WhatsApp agora. O sistema manda um SMS pro cliente e você digita o código aqui mesmo pra ativar o bot na hora.
              </p>

              {/* Nome do perfil WhatsApp */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>NOME NO PERFIL DO WHATSAPP</label>
                <input
                  value={whatsappName}
                  onChange={e => setWhatsappName(e.target.value)}
                  placeholder={companyName || "Ex: Clínica Sorriso Feliz"}
                  className="ark-input"
                  style={{ marginTop: 4, fontSize: 13 }}
                />
                <span style={{ color: '#334155', fontSize: 10, marginTop: 2, display: 'block' }}>
                  Se deixar em branco, usa o nome da empresa.
                </span>
              </div>

              {/* DDD + Número */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <div style={{ flex: '0 0 70px' }}>
                  <label style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>DDI</label>
                  <input
                    value={whatsappCc}
                    onChange={e => setWhatsappCc(e.target.value)}
                    placeholder="55"
                    className="ark-input"
                    style={{ marginTop: 4, textAlign: 'center', padding: '8px 4px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>NÚMERO (com DDD)</label>
                  <input
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    placeholder="11999999999"
                    className="ark-input"
                    style={{ marginTop: 4 }}
                  />
                </div>
              </div>
              <span style={{ color: '#334155', fontSize: 10, marginTop: 4, display: 'block' }}>
                Ex: DDI 55 + número 11999999999 (apenas dígitos, sem espaços ou traços)
              </span>
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
