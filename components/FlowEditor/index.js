import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

const NODE_TYPES = {
  welcome:   { label: 'Boas-vindas', icon: '👋', color: '#06b6d4' },
  message:   { label: 'Mensagem',    icon: '💬', color: '#4f8ef7' },
  menu:      { label: 'Menu',        icon: '📋', color: '#8b5cf6' },
  input:     { label: 'Input',       icon: '✏️', color: '#f59e0b' },
  condition: { label: 'Condição',    icon: '🔀', color: '#10b981' },
  transfer:  { label: 'Transferir',  icon: '🙋', color: '#f97316' },
  end:       { label: 'Encerrar',    icon: '🔚', color: '#ef4444' },
}

// ─────────────────────────────────────────────
// Card de um nó
// ─────────────────────────────────────────────
function NodeCard({ node, onEdit, onDelete, onAddBelow, onAddParallel, isRoot }) {
  const t = NODE_TYPES[node.type] || NODE_TYPES.message
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        onClick={() => onEdit(node)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: '#0d0d1e',
          border: `2px solid ${hovered ? t.color : t.color + '88'}`,
          borderRadius: 12,
          padding: '12px 16px',
          minWidth: 200, maxWidth: 240,
          cursor: 'pointer',
          boxShadow: hovered ? `0 0 22px ${t.color}44` : 'none',
          transition: 'all 0.18s',
          userSelect: 'none'
        }}
      >
        {/* Badge tipo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 14 }}>{t.icon}</span>
          <span style={{ fontSize: 10, color: t.color, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{t.label}</span>
        </div>
        {/* Texto */}
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, wordBreak: 'break-word', minHeight: 18 }}>
          {node.text
            ? node.text.substring(0, 80) + (node.text.length > 80 ? '…' : '')
            : <span style={{ color: '#334155', fontStyle: 'italic' }}>Clique para editar…</span>
          }
        </div>
        {/* Opções do menu */}
        {node.type === 'menu' && node.options?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {node.options.map((o, i) => (
              <div key={i} style={{ fontSize: 10, background: 'rgba(139,92,246,0.1)', borderRadius: 5, padding: '2px 7px', color: '#a78bfa' }}>
                {i + 1}. {o.label || o.keyword || '…'}
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
              transition: 'color 0.15s'
            }}
            title="Remover nó"
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >×</button>
        )}
      </div>

      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {/* ↓ Próximo passo */}
        <button onClick={() => onAddBelow(node.id)}
          title="Adicionar próximo passo (↓)"
          style={{
            background: 'rgba(79,142,247,0.12)',
            border: '1px solid rgba(79,142,247,0.3)',
            borderRadius: 6, color: '#4f8ef7',
            cursor: 'pointer', fontSize: 15, fontWeight: 700,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s'
          }}>+</button>
        {/* → Ramo paralelo */}
        {node.parentId && (
          <button onClick={() => onAddParallel(node.parentId)}
            title="Adicionar opção paralela (→)"
            style={{
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 6, color: '#a78bfa',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
              padding: '0 8px', height: 28,
              transition: 'all 0.15s'
            }}>+ ramo</button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Renderização recursiva de nível
// ─────────────────────────────────────────────
function NodeLevel({ nodeIds, allNodes, onEdit, onDelete, onAddBelow, onAddParallel, depth }) {
  if (!nodeIds?.length) return null
  const nodes = nodeIds.map(id => allNodes.find(n => n.id === id)).filter(Boolean)
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 28, alignItems: 'flex-start', justifyContent: 'center' }}>
      {nodes.map((node, idx) => (
        <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Linha de entrada (não root) */}
          {depth > 0 && (
            <div style={{ width: 2, height: 24, background: 'rgba(79,142,247,0.25)' }} />
          )}
          <NodeCard
            node={node}
            isRoot={depth === 0 && idx === 0}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddBelow={onAddBelow}
            onAddParallel={onAddParallel}
          />
          {/* Filhos */}
          {node.children?.length > 0 && (
            <>
              <div style={{ width: 2, height: 24, background: 'rgba(79,142,247,0.25)' }} />
              {node.children.length > 1 && (
                <div style={{ height: 2, background: 'rgba(79,142,247,0.15)', width: Math.max(node.children.length - 1, 1) * 228 }} />
              )}
              <NodeLevel
                nodeIds={node.children}
                allNodes={allNodes}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddBelow={onAddBelow}
                onAddParallel={onAddParallel}
                depth={depth + 1}
              />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal de edição de nó
// ─────────────────────────────────────────────
function EditModal({ node, onSave, onClose }) {
  const [form, setForm] = useState({ type: node.type, text: node.text || '', options: node.options || [] })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 460, maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ color: '#fff', fontWeight: 700, marginBottom: 20, fontSize: 15 }}>✏️ Editar nó</h3>

        {/* Tipo */}
        <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>TIPO DO NÓ</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {Object.entries(NODE_TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setForm(f => ({ ...f, type: k }))}
              style={{
                padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${form.type === k ? v.color : 'rgba(255,255,255,0.08)'}`,
                background: form.type === k ? v.color + '22' : 'transparent',
                color: form.type === k ? v.color : '#64748b',
                transition: 'all 0.15s'
              }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {/* Texto */}
        <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 6 }}>MENSAGEM DO BOT</label>
        <textarea
          value={form.text}
          onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
          rows={4} placeholder="O que o bot vai dizer aqui?"
          style={{ width: '100%', background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', marginBottom: 18 }}
        />

        {/* Opções (menu) */}
        {form.type === 'menu' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>OPÇÕES DO MENU</label>
              <button onClick={() => setForm(f => ({ ...f, options: [...f.options, { id: uuidv4(), label: '', keyword: '' }] }))}
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, color: '#a78bfa', cursor: 'pointer', fontSize: 11, padding: '4px 10px', fontWeight: 700 }}>
                + opção
              </button>
            </div>
            {form.options.map((opt, i) => (
              <div key={opt.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: 12, minWidth: 18 }}>{i + 1}.</span>
                <input value={opt.label} onChange={e => {
                  const opts = [...form.options]; opts[i] = { ...opts[i], label: e.target.value }; setForm(f => ({ ...f, options: opts }))
                }} placeholder="Texto da opção" style={{ flex: 2, background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 7, color: '#fff', padding: '7px 10px', fontSize: 12, outline: 'none' }} />
                <input value={opt.keyword} onChange={e => {
                  const opts = [...form.options]; opts[i] = { ...opts[i], keyword: e.target.value }; setForm(f => ({ ...f, options: opts }))
                }} placeholder="Palavra-chave" style={{ flex: 1, background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 7, color: '#fff', padding: '7px 10px', fontSize: 12, outline: 'none' }} />
                <button onClick={() => setForm(f => ({ ...f, options: f.options.filter((_,j) => j !== i) }))}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={() => onSave(form)}
            style={{ flex: 1, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Salvar
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

// ─────────────────────────────────────────────
// FlowEditor principal
// ─────────────────────────────────────────────
export default function FlowEditor({ flow, onChange }) {
  const [editing, setEditing] = useState(null)
  const nodes = flow?.nodes || []
  const rootIds = nodes.filter(n => !n.parentId).map(n => n.id)

  function createNode(parentId, type = 'message') {
    const id = uuidv4()
    return { id, type, text: '', parentId: parentId || null, children: [], options: [] }
  }

  function addBelow(parentId) {
    const newNode = createNode(parentId)
    const updated = nodes.map(n => n.id === parentId ? { ...n, children: [...(n.children || []), newNode.id] } : n)
    onChange({ ...flow, nodes: [...updated, newNode] })
  }

  function addParallel(sharedParentId) {
    const newNode = createNode(sharedParentId)
    const updated = nodes.map(n => n.id === sharedParentId ? { ...n, children: [...(n.children || []), newNode.id] } : n)
    onChange({ ...flow, nodes: [...updated, newNode] })
  }

  function deleteNode(id) {
    const toRemove = new Set()
    const collect = nid => {
      toRemove.add(nid)
      nodes.find(n => n.id === nid)?.children?.forEach(collect)
    }
    collect(id)
    const updated = nodes
      .filter(n => !toRemove.has(n.id))
      .map(n => ({ ...n, children: (n.children || []).filter(c => !toRemove.has(c)) }))
    onChange({ ...flow, nodes: updated })
  }

  function saveEdit(form) {
    const updated = nodes.map(n => n.id === editing.id ? { ...n, ...form } : n)
    onChange({ ...flow, nodes: updated })
    setEditing(null)
  }

  if (!nodes.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌿</div>
        <p style={{ color: '#475569', marginBottom: 20 }}>Nenhum fluxo criado ainda.</p>
        <button onClick={() => {
          const welcome = createNode(null)
          onChange({ ...flow, nodes: [{ ...welcome, type: 'welcome', text: 'Olá! Sou o Assistente Ark 🤖\nComo posso te ajudar hoje?' }] })
        }} style={{ background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px 28px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          Criar fluxo
        </button>
      </div>
    )
  }

  return (
    <div>
      {editing && <EditModal node={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
      <div style={{ overflowX: 'auto', padding: '36px 24px', minHeight: 300 }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          <NodeLevel
            nodeIds={rootIds}
            allNodes={nodes}
            onEdit={setEditing}
            onDelete={deleteNode}
            onAddBelow={addBelow}
            onAddParallel={addParallel}
            depth={0}
          />
        </div>
      </div>
      <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(79,142,247,0.08)', fontSize: 12, color: '#334155' }}>
        💡 <b style={{ color: '#4f8ef7' }}>+</b> próximo passo &nbsp;·&nbsp; <b style={{ color: '#a78bfa' }}>+ ramo</b> opção paralela &nbsp;·&nbsp; Clique no card para editar
      </div>
    </div>
  )
}
