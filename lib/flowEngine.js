// Motor de navegação do fluxo conversacional — versão simplificada (blocos únicos com botões)
// Cada nó tem: text + buttons[]. Cada button cria automaticamente um filho.
// Compatível com fluxos antigos (menu/options/keyword) via fallback.

const RESET_KEYWORDS = ['0', 'menu', 'inicio', 'início', 'reiniciar', 'comecar', 'começar']

export function isResetCommand(text) {
  return RESET_KEYWORDS.includes((text || '').trim().toLowerCase())
}

export function getRootNode(nodes) {
  return nodes.find(n => !n.parentId) || nodes[0]
}

export function findNode(nodes, id) {
  return nodes.find(n => n.id === id)
}

// Resolve a transição a partir do nó atual dado o input do usuário.
// Retorna { node } quando avança, { node: current, invalidOption: true } quando
// o input não corresponde a nenhuma opção, ou { node: null } quando chegou ao fim.
export function resolveNext(nodes, current, userInput) {
  // ── NOVO MODELO: botões interativos ──
  // Cada botão tem um id. O webhook envia interactive.button_reply.id.
  // Buscamos pelo id do botão → children[idx] correspondente.
  if (current.buttons?.length) {
    // Match por button id (vindo do interactive reply)
    const btnIdx = current.buttons.findIndex(b => b.id === userInput || b.label?.toLowerCase() === userInput?.toLowerCase())
    if (btnIdx > -1) {
      const childId = current.children?.[btnIdx]
      const next = childId && findNode(nodes, childId)
      if (next) return { node: next }
    }
    return { node: current, invalidOption: true }
  }

  // ── FALLBACK: fluxos antigos com options (menu + keyword) ──
  if (current.options?.length) {
    const idx = current.options.findIndex(o =>
      o.keyword?.toLowerCase() === userInput?.toLowerCase() || o.id === userInput
    )
    if (idx > -1) {
      const opt = current.options[idx]
      const targetId = opt.nextId || current.children?.[idx]
      const next = targetId && findNode(nodes, targetId)
      if (next) return { node: next }
    }
    return { node: current, invalidOption: true }
  }

  // Nó sem botões nem opções: avança pelo primeiro filho (ou termina)
  const firstChild = current.children?.[0]
  if (firstChild) {
    const next = findNode(nodes, firstChild)
    if (next) return { node: next }
  }
  return { node: null }
}

// Retrocompatibilidade
export function getNextNode(nodes, currentId, userInput) {
  const current = findNode(nodes, currentId)
  if (!current) return null
  const { node, invalidOption } = resolveNext(nodes, current, userInput)
  return invalidOption ? null : node
}

// Processa uma mensagem e retorna o que responder + novo estado.
// action: 'root' | 'advance' | 'repeat' | 'transfer' | 'end' | 'catalog' | 'payment' | 'none'
export function processFlow(nodes, currentNodeId, userInput, { greeting } = {}) {
  if (!nodes?.length) {
    return { reply: greeting || 'Olá! Como posso ajudar?', nodeId: null, action: 'none' }
  }

  if (isResetCommand(userInput) || !currentNodeId) {
    const root = getRootNode(nodes)
    return { reply: root?.text || greeting, nodeId: root?.id || null, action: 'root', node: root }
  }

  const current = findNode(nodes, currentNodeId)
  if (!current) {
    const root = getRootNode(nodes)
    return { reply: root?.text || greeting, nodeId: root?.id || null, action: 'root', node: root }
  }

  const { node: next, invalidOption } = resolveNext(nodes, current, userInput)

  if (invalidOption) {
    return { reply: current.text, nodeId: current.id, action: 'repeat', node: current }
  }

  if (!next) {
    // Fim do ramo — volta ao menu principal
    const root = getRootNode(nodes)
    return { reply: root?.text || greeting, nodeId: root?.id || null, action: 'root', node: root }
  }

  // Ações especiais (propriedade do nó, não tipo separado)
  if (next.action === 'transfer') {
    return { reply: next.text || '👤 Transferindo para nossa equipe! Em breve um atendente entrará em contato.', nodeId: next.id, action: 'transfer', node: next }
  }
  if (next.action === 'end') {
    return { reply: next.text || 'Conversa encerrada. Digite qualquer coisa para recomeçar. 👋', nodeId: null, action: 'end', node: next }
  }
  if (next.action === 'catalog') {
    return { reply: next.text, nodeId: next.id, action: 'catalog', category: next.category || null, node: next }
  }
  if (next.action === 'payment') {
    return { reply: next.text, nodeId: next.id, action: 'payment', amount: next.amount || null, payMethod: next.payMethod || 'pix', node: next }
  }

  // Compatibilidade: type antigo
  if (next.type === 'transfer') {
    return { reply: next.text || '👤 Transferindo para nossa equipe! Em breve um atendente entrará em contato.', nodeId: next.id, action: 'transfer', node: next }
  }
  if (next.type === 'end') {
    return { reply: next.text || 'Conversa encerrada. Digite qualquer coisa para recomeçar. 👋', nodeId: null, action: 'end', node: next }
  }
  if (next.type === 'catalog') {
    return { reply: next.text, nodeId: next.id, action: 'catalog', category: next.category || null, node: next }
  }
  if (next.type === 'payment') {
    return { reply: next.text, nodeId: next.id, action: 'payment', amount: next.amount || null, payMethod: next.payMethod || 'pix', node: next }
  }

  return { reply: next.text, nodeId: next.id, action: 'advance', node: next }
}

// Retorna os botões de um nó (do novo modelo buttons[] ou do antigo options[])
export function getNodeButtons(node) {
  if (node.buttons?.length) return node.buttons
  if (node.options?.length) return node.options.map((o, i) => ({ id: o.id || `opt_${i}`, label: o.label || o.keyword || '' }))
  return []
}

// Retrocompatibilidade
export async function processMessage(bot, convRow, userText, { supabase } = {}) {
  const nodes = bot.flow?.nodes || []
  const result = processFlow(nodes, convRow.current_node_id, userText, { greeting: bot.greeting })
  if (supabase) {
    await supabase.from('conversations')
      .update({ current_node_id: result.nodeId, last_message: result.reply, last_message_at: new Date().toISOString() })
      .eq('id', convRow.id)
  }
  return { ...result, node: findNode(nodes, result.nodeId) }
}
