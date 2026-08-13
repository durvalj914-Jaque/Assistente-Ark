import { useState, Component } from 'react'
import { v4 as uuidv4 } from 'uuid'

// Ações especiais que um bloco pode ter (além de texto + botões)
const BLOCK_ACTIONS = {
  none:      { label: 'Nenhuma',           icon: '✏️' },
  transfer:  { label: 'Transferir humano',  icon: '🙋' },
  catalog:   { label: 'Mostrar catálogo',    icon: '📦' },
  payment:   { label: 'Cobrar pagamento',     icon: '💰' },
  end:       { label: 'Encerrar conversa',   icon: '🔚' },
}

// Guarda de profundidade
const MAX_DEPTH = 25

// ─── Error Boundary ───
class FlowErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, errorMsg: String(err?.message || err) }
  }
  componentDidCatch(err) { console.error('[FlowEditor] Erro:', err) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Erro ao renderizar o fluxo</p>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
            {this.state.errorMsg}<br/>Recarregue a página e tente novamente.
          </p>
          <button onClick={() => { this.setState({ hasError: false, errorMsg: '' }); this.props.onReset?.() }}
            style={{ background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Voltar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Card de um bloco ───
function BlockCard({ node, onEdit, onDelete, isRoot, depth }) {
  const [hovered, setHovered] = useState(false)
  const buttons = node.buttons || []
  const action = BLOCK_ACTIONS[node.action] || BLOCK_ACTIONS.none

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={() => onEdit(node)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: '#0d0d1e',
          border: `2px solid ${hovered ? '#4f8ef7' : 'rgba(79,142,247,0.4)'}`,
          borderRadius: 14,
          padding: '14px 18px',
          minWidth: 220, maxWidth: 280,
          cursor: 'pointer',
          boxShadow: hovered ? '0 0 24px rgba(79,142,247,0.15)' : 'none',
          transition: 'all 0.18s',
          userSelect: 'none',
        }}
      >
        {/* Header do bloco */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11 }}>{action.icon}</span>
            <span style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {isRoot ? 'Início' : 'Bloco'}
            </span>
          </div>
          {node.action && node.action !== 'none' && (
            <span style={{ fontSize: 9, color: '#4f8ef7', fontWeight: 600, background: 'rgba(79,142,247,0.1)', padding: '2px 7px', borderRadius: 4 }}>
              {action.label}
            </span>
          )}
        </div>

        {/* Texto do bloco */}
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, wordBreak: 'break-word', minHeight: 18, whiteSpace: 'pre-wrap' }}>
          {node.text
            ? (node.text.length > 100 ? node.text.substring(0, 100) + '…' : node.text)
            : <span style={{ color: '#334155', fontStyle: 'italic' }}>Clique para editar…</span>
          }
        </div>

        {/* Botões do bloco */}
        {buttons.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {buttons.map((b, i) => (
              <div key={b.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, background: 'rgba(79,142,247,0.08)',
                borderRadius: 6, padding: '4px 8px', color: '#4f8ef7', fontWeight: 500,
              }}>
                <span style={{ fontSize: 9, color: '#334155' }}>▸</span>
                {b.label || '...'}
              </div>
            ))}
          </div>
        )}

        {/* Delete */}
        {!isRoot && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(node.id) }}
            style={{
              position: 'absolute', top: 6, right: 8,
              background: 'none', border: 'none',
              color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1,
              transition: 'color 0.15s',
            }}
            title="Remover bloco"
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>×</button>
        )}
      </div>
    </div>
  )
}

// ─── Renderização recursiva ───
function BlockLevel({ nodeIds, allNodes, onEdit, onDelete, depth, visited }) {
  if (!nodeIds?.length) return null
  if (depth > MAX_DEPTH) {
    return <div style={{ fontSize: 11, color: '#f59e0b', padding: 8 }}>⚠️ Profundidade máxima atingida</div>
  }

  const nodes = nodeIds.map(id => allNodes.find(n => n.id === id)).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 32, alignItems: 'flex-start', justifyContent: 'center' }}>
      {nodes.map((node, idx) => {
        if (visited.has(node.id)) {
          return <div key={`${node.id}_cycle`} style={{ fontSize: 11, color: '#f59e0b', padding: 4 }}>↩️ (ciclo)</div>
        }
        const childVisited = new Set(visited)
        childVisited.add(node.id)

        return (
          <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {depth > 0 && <div style={{ width: 2, height: 24, background: 'rgba(79,142,247,0.25)' }} />}
            <BlockCard node={node} isRoot={depth === 0 && idx === 0} onEdit={onEdit} onDelete={onDelete} depth={depth} />
            {node.children?.length > 0 && (
              <>
                <div style={{ width: 2, height: 24, background: 'rgba(79,142,247,0.25)' }} />
                {node.children.length > 1 && (
                  <div style={{ height: 2, background: 'rgba(79,142,247,0.12)', width: Math.max(node.children.length - 1, 1) * 252 }} />
                )}
                <BlockLevel
                  nodeIds={node.children}
                  allNodes={allNodes}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  depth={depth + 1}
                  visited={childVisited}
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Modal de edição do bloco ───
function EditModal({ node, onSave, onClose }) {
  const [form, setForm] = useState({
    text: node.text || '',
    buttons: node.buttons || [],
    action: node.action || 'none',
    category: node.category || '',
    amount: node.amount || '',
    payMethod: node.payMethod || 'pix',
  })

  function addButton() {
    const newBtn = { id: uuidv4(), label: '' }
    setForm(f => ({ ...f, buttons: [...f.buttons, newBtn] }))
  }

  function updateButton(i, label) {
    const btns = [...form.buttons]
    btns[i] = { ...btns[i], label }
    setForm(f => ({ ...f, buttons: btns }))
  }

  function removeButton(i) {
    setForm(f => ({ ...f, buttons: f.buttons.filter((_, j) => j !== i) }))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 500, maxHeight: '88vh', overflowY: 'auto' }}>
        <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 20, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✏️ Editar bloco
        </h3>

        {/* Texto */}
        <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>MENSAGEM (texto do bot)</label>
        <textarea
          value={form.text}
          onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
          rows={5}
          placeholder="O que o bot vai enviar aqui? (até 4000 caracteres)"
          style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', marginBottom: 18 }}
        />

        {/* Ação especial */}
        <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>AÇÃO DESTE BLOCO</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {Object.entries(BLOCK_ACTIONS).map(([k, v]) => (
            <button key={k} onClick={() => setForm(f => ({ ...f, action: k }))}
              style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${form.action === k ? '#4f8ef7' : 'rgba(255,255,255,0.08)'}`,
                background: form.action === k ? 'rgba(79,142,247,0.12)' : 'transparent',
                color: form.action === k ? '#4f8ef7' : '#64748b',
                transition: 'all 0.15s',
              }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {/* Campos extras para catálogo */}
        {form.action === 'catalog' && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>CATEGORIA (opcional)</label>
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="Deixe vazio pra mostrar todos os produtos ativos"
              style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, outline: 'none' }} />
          </div>
        )}

        {/* Campos extras para pagamento */}
        {form.action === 'payment' && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>VALOR (R$)</label>
            <input type="number" step="0.01" min="0.01" value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="29.90 (vazio = valor livre)"
              style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, outline: 'none', marginBottom: 10 }} />
            <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 6 }}>MÉTODO</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['pix', 'mercadopago'].map(m => (
                <button key={m} onClick={() => setForm(f => ({ ...f, payMethod: m }))}
                  style={{ flex: 1, padding: '7px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border: `1px solid ${form.payMethod === m ? '#22c55e' : 'rgba(255,255,255,0.08)'}`,
                    background: form.payMethod === m ? 'rgba(34,197,94,0.12)' : 'transparent',
                    color: form.payMethod === m ? '#22c55e' : '#64748b' }}>
                  {m === 'pix' ? '💠 PIX' : '💳 Mercado Pago'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Botões interativos */}
        {form.action === 'none' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                BOTÕES INTERATIVOS
              </label>
              {form.buttons.length < 10 && (
                <button onClick={addButton}
                  style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 6, color: '#4f8ef7', cursor: 'pointer', fontSize: 11, padding: '5px 12px', fontWeight: 700 }}>
                  + botão
                </button>
              )}
            </div>
            <p style={{ color: '#334155', fontSize: 11, marginBottom: 10 }}>
              Cada botão cria automaticamente um novo bloco abaixo. O cliente toca no botão (sem digitar números).
              {form.buttons.length > 3 && form.buttons.length <= 10 && ' (será enviado como lista)'}
              {form.buttons.length > 3 && ' WhatsApp aceita no máximo 10 botões.'}
            </p>
            {form.buttons.map((btn, i) => (
              <div key={btn.id || i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: 14, minWidth: 20 }}>▸</span>
                <input
                  value={btn.label}
                  onChange={e => updateButton(i, e.target.value)}
                  placeholder={`Texto do botão ${i + 1}`}
                  maxLength={20}
                  style={{ flex: 1, background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 7, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none' }}
                />
                <button onClick={() => removeButton(i)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {form.action !== 'none' && (
          <p style={{ color: '#334155', fontSize: 11, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            💡 Blocos com ação especial não precisam de botões — eles executam a ação e terminam.
          </p>
        )}

        {/* Botões do modal */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={() => onSave(form)}
            style={{ flex: 1, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Salvar bloco
          </button>
          <button onClick={onClose}
            style={{ background: 'transparent', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8, color: '#64748b', padding: '10px 18px', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FlowEditor principal ───
export default function FlowEditor({ flow, onChange }) {
  const [editing, setEditing] = useState(null)
  const [renderKey, setRenderKey] = useState(0)
  const nodes = flow?.nodes || []
  const rootIds = nodes.filter(n => !n.parentId).map(n => n.id)

  function createNode(parentId) {
    const id = uuidv4()
    return { id, text: '', parentId: parentId || null, children: [], buttons: [], action: 'none' }
  }

  // Quando um botão é salvo, sincroniza children com buttons
  function saveEdit(form) {
    const editingNode = nodes.find(n => n.id === editing.id)
    if (!editingNode) { setEditing(null); return }

    // Determinar children: manter os que existem, adicionar novos para botões novos, remover os que sumiram
    const oldChildren = editingNode.children || []
    const oldButtons = editingNode.buttons || []

    // Map old buttons to their children
    const newChildren = form.buttons.map((btn, i) => {
      // Se já existe um child nesta posição, manter
      if (i < oldChildren.length && oldButtons[i] && oldButtons[i].id === btn.id) {
        return oldChildren[i]
      }
      // Se é um botão que existia antes mas mudou de posição, tentar reusar
      const oldIdx = oldButtons.findIndex(ob => ob.id === btn.id)
      if (oldIdx > -1 && oldChildren[oldIdx]) {
        return oldChildren[oldIdx]
      }
      // Novo botão — criar novo bloco filho
      const child = createNode(editingNode.id)
      child.text = btn.label ? btn.label : ''
      return child.id
    })

    // Encontrar nós filhos removidos (que não estão mais em newChildren)
    const removedChildIds = oldChildren.filter(cid => !newChildren.includes(cid))

    // Construir novo array de nós
    let updatedNodes = [...nodes]

    // Atualizar nó editado
    const editIdx = updatedNodes.findIndex(n => n.id === editingNode.id)
    updatedNodes[editIdx] = {
      ...editingNode,
      text: form.text,
      buttons: form.buttons,
      action: form.action,
      category: form.category || undefined,
      amount: form.amount || undefined,
      payMethod: form.payMethod || undefined,
      children: newChildren,
    }

    // Adicionar novos nós filhos
    for (const btn of form.buttons) {
      const oldIdx = oldButtons.findIndex(ob => ob.id === btn.id)
      const hasChild = oldIdx > -1 && oldChildren[oldIdx]
      if (!hasChild) {
        // Criar novo bloco filho com o nome do botão
        const child = createNode(editingNode.id)
        child.text = btn.label || ''
        updatedNodes.push(child)
      }
    }

    // Remover nós filhos removidos (e seus descendentes)
    if (removedChildIds.length > 0) {
      const toRemove = new Set(removedChildIds)
      let changed = true
      while (changed) {
        changed = false
        for (const n of updatedNodes) {
          if (n.children?.some(cid => toRemove.has(cid) && !toRemove.has(n.id))) {
            toRemove.add(n.id)
            changed = true
          }
        }
      }
      updatedNodes = updatedNodes.filter(n => !toRemove.has(n.id))
    }

    onChange({ ...flow, nodes: updatedNodes })
    setEditing(null)
    setRenderKey(k => k + 1)
  }

  function deleteNode(nodeId) {
    if (!nodeId) return
    // Coletar nó + todos os descendentes
    const toRemove = new Set([nodeId])
    let changed = true
    while (changed) {
      changed = false
      for (const n of nodes) {
        if (n.children?.some(cid => toRemove.has(cid)) && !toRemove.has(n.id)) {
          toRemove.add(n.id)
          changed = true
        }
      }
    }
    const updatedNodes = nodes
      .filter(n => !toRemove.has(n.id))
      .map(n => ({
        ...n,
        children: (n.children || []).filter(cid => !toRemove.has(cid)),
        buttons: (n.buttons || []).filter((b, i) => {
          const childId = n.children?.[i]
          return childId && !toRemove.has(childId)
        }),
      }))
    onChange({ ...flow, nodes: updatedNodes })
    setRenderKey(k => k + 1)
  }

  function handleReset() {
    setRenderKey(k => k + 1)
  }

  if (!nodes.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
        <p style={{ color: '#475569', marginBottom: 20 }}>Nenhum fluxo criado ainda.</p>
        <button onClick={() => {
          const root = createNode(null)
          root.text = 'Olá! Como posso te ajudar hoje?'
          onChange({ ...flow, nodes: [root] })
        }} style={{ background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px 28px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          Criar fluxo
        </button>
      </div>
    )
  }

  return (
    <FlowErrorBoundary key={renderKey} onReset={handleReset}>
      {editing && <EditModal node={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      <div style={{ overflow: 'auto', padding: '36px 24px', minHeight: 300, maxHeight: 'calc(100vh - 280px)' }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          <BlockLevel
            key={`tree_${renderKey}`}
            nodeIds={rootIds}
            allNodes={nodes}
            onEdit={setEditing}
            onDelete={deleteNode}
            depth={0}
            visited={new Set()}
          />
        </div>
      </div>
      <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(79,142,247,0.08)', fontSize: 12, color: '#334155' }}>
        💡 Clique no bloco para editar &nbsp;·&nbsp; Cada botão cria automaticamente um novo bloco abaixo &nbsp;·&nbsp; Máx 10 botões por bloco
      </div>
    </FlowErrorBoundary>
  )
}
