export function getRootNode(nodes) {
  return nodes.find(n => !n.parentId) || nodes[0]
}

export function findNode(nodes, id) {
  return nodes.find(n => n.id === id)
}

export function getNextNode(nodes, currentId, userInput) {
  const current = findNode(nodes, currentId)
  if (!current) return null
  if (current.type === 'menu') {
    const opt = current.options?.find(o =>
      o.keyword?.toLowerCase() === userInput?.toLowerCase() || o.id === userInput
    )
    return opt?.nextId ? findNode(nodes, opt.nextId) : null
  }
  const firstChild = current.children?.[0]
  return firstChild ? findNode(nodes, firstChild) : null
}

export async function processMessage(bot, convRow, userText, { supabase, sendFn }) {
  const nodes = bot.flow?.nodes || []
  if (!nodes.length) return { reply: bot.greeting || 'Olá!' }
  let currentNode
  if (!convRow.current_node_id) {
    currentNode = getRootNode(nodes)
  } else {
    currentNode = getNextNode(nodes, convRow.current_node_id, userText)
  }
  if (!currentNode) {
    return { reply: bot.fallback_message || 'Não entendi. Pode repetir?' }
  }
  await supabase.from('conversations')
    .update({ current_node_id: currentNode.id, last_message: currentNode.text, last_message_at: new Date().toISOString() })
    .eq('id', convRow.id)
  return { reply: currentNode.text, node: currentNode }
}
