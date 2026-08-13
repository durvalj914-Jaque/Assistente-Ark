// Migra fluxo antigo (múltiplos tipos) para o novo formato (bloco único com botões)
function migrateFlow(flow) {
  if (!flow?.nodes?.length) return flow
  const migrated = flow.nodes.map(node => {
    const newNode = { ...node }
    if (node.options?.length && !node.buttons?.length) {
      newNode.buttons = node.options.map(opt => ({
        id: opt.id || `btn_${Math.random().toString(36).substr(2, 9)}`,
        label: opt.label || opt.keyword || '',
      }))
    }
    if (!newNode.buttons) newNode.buttons = []
    if (node.type && !node.action) {
      const specialTypes = ['transfer', 'catalog', 'payment', 'end']
      newNode.action = specialTypes.includes(node.type) ? node.type : 'none'
    }
    if (!newNode.action) newNode.action = 'none'
    return newNode
  })
  return { ...flow, nodes: migrated }
}
module.exports = { migrateFlow }
