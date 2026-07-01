// Motor de navegação do fluxo conversacional — usado pelo webhook (WhatsApp)
// e compatível com a estrutura gerada pelo Editor de Fluxo visual (components/FlowEditor).

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
// o input não corresponde a nenhuma opção do menu, ou { node: null } quando
// chegou ao fim do ramo (sem próximo nó).
export function resolveNext(nodes, current, userInput) {
  if (current.type === 'menu') {
    const opt = current.options?.find(o =>
      o.keyword?.toLowerCase() === userInput?.toLowerCase() || o.id === userInput
    )
    if (opt?.nextId) {
      const next = findNode(nodes, opt.nextId)
      if (next) return { node: next }
    }
    return { node: current, invalidOption: true }
  }
  // welcome / message / input / condition / transfer: avança pelo primeiro filho
  const firstChild = current.children?.[0]
  if (firstChild) {
    const next = findNode(nodes, firstChild)
    if (next) return { node: next }
  }
  return { node: null }
}

// Retrocompatibilidade (assinatura antiga usada em versões anteriores)
export function getNextNode(nodes, currentId, userInput) {
  const current = findNode(nodes, currentId)
  if (!current) return null
  const { node, invalidOption } = resolveNext(nodes, current, userInput)
  return invalidOption ? null : node
}

// Processa uma mensagem recebida e retorna o que responder + o novo estado da conversa.
// action: 'root' | 'advance' | 'repeat' | 'transfer' | 'end' | 'none'
export function processFlow(nodes, currentNodeId, userInput, { greeting } = {}) {
  if (!nodes?.length) {
    return { reply: greeting || 'Olá! Como posso ajudar?', nodeId: null, action: 'none' }
  }

  if (isResetCommand(userInput) || !currentNodeId) {
    const root = getRootNode(nodes)
    return { reply: root?.text || greeting, nodeId: root?.id || null, action: 'root' }
  }

  const current = findNode(nodes, currentNodeId)
  if (!current) {
    const root = getRootNode(nodes)
    return { reply: root?.text || greeting, nodeId: root?.id || null, action: 'root' }
  }

  const { node: next, invalidOption } = resolveNext(nodes, current, userInput)

  if (invalidOption) {
    return { reply: current.text, nodeId: current.id, action: 'repeat' }
  }

  if (!next) {
    // Fim do ramo (nó de texto sem continuação) — volta ao menu principal
    const root = getRootNode(nodes)
    return { reply: root?.text || greeting, nodeId: root?.id || null, action: 'root' }
  }

  if (next.type === 'transfer') {
    return { reply: next.text || '👤 Transferindo para nossa equipe! Em breve um atendente entrará em contato.', nodeId: next.id, action: 'transfer' }
  }

  if (next.type === 'end') {
    return { reply: next.text || 'Conversa encerrada. Digite qualquer coisa para recomeçar. 👋', nodeId: null, action: 'end' }
  }

  return { reply: next.text, nodeId: next.id, action: 'advance' }
}

// Retrocompatibilidade: função antiga usada em versões anteriores do webhook
export async function processMessage(bot, convRow, userText, { supabase } = {}) {
  const nodes = bot.flow?.nodes || []
  const result = processFlow(nodes, convRow.current_node_id, userText, { greeting: bot.greeting })
  if (supabase) {
    await supabase.from('conversations')
      .update({ current_node_id: result.nodeId, last_message: result.reply, last_message_at: new Date().toISOString() })
      .eq('id', convRow.id)
  }
  return { reply: result.reply, node: findNode(nodes, result.nodeId) }
}
