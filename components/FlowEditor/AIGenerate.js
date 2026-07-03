import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AIGenerateButton({ botId, onGenerated, hasExistingFlow }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (!description.trim() || !botId) return
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/generate-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ bot_id: botId, description }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Erro ao gerar fluxo')
      onGenerated(data.flow)
      setOpen(false)
      setDescription('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function close() {
    if (loading) return
    setOpen(false)
    setError('')
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="ark-btn-ghost">✨ Gerar com IA</button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && close()}
        >
          <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 480, maxWidth: '100%' }}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 15 }}>✨ Gerar fluxo com IA</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
              Descreva seu negócio e como quer que o bot atenda — a IA monta o fluxo completo (menu, opções, transferência pra humano) pra você revisar e ajustar.
            </p>

            {hasExistingFlow && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#f59e0b', marginBottom: 14 }}>
                ⚠️ Isso substitui o fluxo que está na tela agora. Só grava de verdade quando você clicar em "Salvar fluxo" — se não gostar, dá pra recarregar a página sem perder o que já estava salvo.
              </div>
            )}

            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              maxLength={1500}
              placeholder='Ex: "Sou uma clínica odontológica. Quero que o bot tire dúvidas sobre tratamentos, agende consulta e transfira pra recepção em casos urgentes."'
              style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 14 }}
            />

            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={generate}
                disabled={loading || !description.trim()}
                style={{ flex: 1, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', cursor: loading ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, opacity: loading || !description.trim() ? 0.7 : 1 }}
              >
                {loading ? 'Gerando…' : 'Gerar fluxo'}
              </button>
              <button
                onClick={close}
                style={{ background: 'transparent', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8, color: '#64748b', padding: '10px 18px', cursor: 'pointer', fontSize: 13 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
