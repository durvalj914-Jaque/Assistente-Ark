import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

// Normaliza um fluxo colado em JSON pro formato exato que o Editor de Fluxo
// e o motor de execução esperam — preenche campos que faltarem, sem travar
// por causa de JSON "quase certo" (ex: exportado de outro bot, editado à mão,
// ou vindo da IA sem passar pelo endpoint de geração).
function normalizeFlow(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON inválido: esperado um objeto')
  if (!Array.isArray(parsed.nodes)) throw new Error('JSON inválido: falta o array "nodes"')
  if (!parsed.nodes.length) throw new Error('O fluxo colado não tem nenhum nó')

  // Garante id único em todo nó (gera um novo se faltar ou vier duplicado)
  const seenIds = new Set()
  const nodes = parsed.nodes.map(n => {
    let id = n.id
    if (!id || seenIds.has(id)) id = uuidv4()
    seenIds.add(id)
    return {
      ...n,
      id,
      type: n.type || 'message',
      text: n.text || '',
      parentId: n.parentId ?? null,
      children: Array.isArray(n.children) ? n.children : [],
      options: Array.isArray(n.options) ? n.options : [],
    }
  })

  const validIds = new Set(nodes.map(n => n.id))

  // Remove referências (children/options.nextId) que apontem pra ids que não existem
  const cleaned = nodes.map(n => ({
    ...n,
    children: n.children.filter(c => validIds.has(c)),
    options: n.options.map(o => (o.nextId && !validIds.has(o.nextId)) ? { ...o, nextId: null } : o),
  }))

  return { name: parsed.name || 'Fluxo Principal', nodes: cleaned }
}

export default function JsonTools({ flow, onChange }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(flow, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError('Não foi possível copiar automaticamente — selecione o texto manualmente.')
    }
  }

  function applyPaste() {
    setError('')
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setError('Isso não é um JSON válido. Confira se copiou o conteúdo completo.')
      return
    }
    try {
      const normalized = normalizeFlow(parsed)
      onChange(normalized)
      setOpen(false)
      setText('')
    } catch (e) {
      setError(e.message)
    }
  }

  function close() {
    setOpen(false)
    setText('')
    setError('')
  }

  return (
    <>
      <button onClick={copyJson} className="ark-btn-ghost" title="Copia o fluxo completo (JSON) pra área de transferência">
        {copied ? '✅ Copiado!' : '📋 Copiar JSON'}
      </button>
      <button onClick={() => setOpen(true)} className="ark-btn-ghost" title="Cola um fluxo em JSON (substitui o que está na tela)">
        📥 Colar JSON
      </button>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && close()}
        >
          <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 560, maxWidth: '100%' }}>
            <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 6, fontSize: 15 }}>📥 Colar fluxo em JSON</h3>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
              Cole aqui o JSON de um fluxo (exportado com "Copiar JSON" de outro bot, por exemplo). Isso só troca o que está na tela — nada é gravado até você clicar em "Salvar fluxo".
            </p>

            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#f59e0b', marginBottom: 14 }}>
              ⚠️ Isso substitui o fluxo atual na tela. Se não gostar, dá pra recarregar a página sem perder o que já estava salvo.
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder='Cole aqui o JSON do fluxo, ex: { "name": "Fluxo Principal", "nodes": [ ... ] }'
              style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 12.5, fontFamily: 'monospace', outline: 'none', resize: 'vertical', marginBottom: 14 }}
            />

            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={applyPaste}
                disabled={!text.trim()}
                style={{ flex: 1, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: !text.trim() ? 0.6 : 1 }}
              >
                Usar este fluxo
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
