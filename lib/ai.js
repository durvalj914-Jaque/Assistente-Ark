// Geração de fluxo de atendimento via IA (OpenAI).
// Modelo configurável por env var OPENAI_MODEL (fallback: gpt-4.1-mini) — trocar
// o modelo não exige alteração de código, só a variável de ambiente no Vercel.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-4.1-mini'
const VALID_TYPES = ['welcome', 'message', 'menu', 'input', 'condition', 'transfer', 'end']
const MAX_NODES = 20

const SYSTEM_PROMPT = `Você é um especialista em desenhar fluxos de atendimento (chatbot) pra WhatsApp Business.
Sua tarefa: a partir da descrição de um negócio, gerar uma árvore de conversa em JSON.

Regras do formato (siga exatamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown.
- Formato: { "nodes": [ { "id": string, "type": string, "text": string, "options": [ { "keyword": string, "label": string, "nextId": string } ] } ] }
- "id": string curta, única, em snake_case (ex: "root", "produtos", "suporte").
- "type": um destes:
  - "welcome": primeira mensagem, é a raiz do fluxo — deve existir exatamente 1.
  - "message": texto informativo, o bot manda e segue pro próximo passo automaticamente.
  - "menu": mensagem + espera resposta do cliente por palavra-chave — use "options" pra ramificar.
  - "transfer": transfere pra atendimento humano (a conversa passa a ser respondida por uma pessoa).
  - "end": encerra a conversa.
- "text": a mensagem que o bot manda nesse passo. Pode ter emojis, listas numeradas, *negrito* (markdown do WhatsApp). Sempre que o texto de um nó "menu" listar opções numeradas, cada uma deve ter uma entrada correspondente em "options" na MESMA ORDEM.
- "options": só em nós tipo "menu". Cada opção tem "keyword" (o que o cliente digita, ex: "1"), "label" (nome curto da opção) e "nextId" (o "id" de outro nó da mesma lista, pra onde essa opção leva).
- Gere sempre: 1 nó "welcome" (raiz, cumprimento + apresenta as opções principais), 1 nó "menu" logo em seguida com as opções principais do atendimento, e pelo menos 1 nó "transfer" alcançável (pra falar com humano).
- Textos em português do Brasil, tom acolhedor e direto. Não invente preços, prazos ou promessas que não estejam na descrição do usuário.
- Gere no máximo ${MAX_NODES} nós.`

export async function generateFlowFromDescription(description, { model } = {}) {
  const useModel = model || process.env.OPENAI_MODEL || DEFAULT_MODEL
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada no servidor')

  const userPrompt = `Descrição do negócio / como o bot deve atender:\n"""${description}"""\n\nGere o fluxo completo em JSON conforme as regras do sistema.`

  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: useModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  })

  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || `Erro ao chamar a OpenAI (${r.status})`)

  const raw = data.choices?.[0]?.message?.content
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('A IA retornou um JSON inválido — tente descrever de outro jeito.')
  }

  return sanitizeFlow(parsed)
}

// Normaliza a saída da IA pro formato exato que o motor de fluxo (lib/flowEngine.js)
// e o Editor de Fluxo visual esperam: ids únicos, options.nextId resolvido, children[]
// derivado por posição a partir das options, parentId consistente, um único nó raiz,
// e nenhum nó órfão/inalcançável sobrando solto no meio da árvore.
function sanitizeFlow(parsed) {
  const rawNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
  if (!rawNodes.length) throw new Error('A IA não gerou nenhum nó de fluxo.')

  const trimmed = rawNodes.slice(0, MAX_NODES)

  const seenIds = new Set()
  const idMap = {} // id original (como a IA mandou) -> id normalizado

  const nodes = trimmed.map((n, i) => {
    const origId = n?.id != null ? String(n.id) : `n${i}`
    let id = origId.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || `n${i}`
    while (seenIds.has(id)) id = `${id}_${i}`
    seenIds.add(id)
    idMap[origId] = id

    const type = VALID_TYPES.includes(n?.type) ? n.type : 'message'
    const text = String(n?.text || '').slice(0, 1200)
    const rawOptions = Array.isArray(n?.options) ? n.options : []
    const options = rawOptions.slice(0, 10).map((o, j) => ({
      id: `opt_${id}_${j}`,
      keyword: String(o?.keyword ?? j + 1).trim().slice(0, 30),
      label: String(o?.label || '').slice(0, 80),
      nextIdRaw: o?.nextId != null ? String(o.nextId) : null,
    }))

    return { id, type, text, options }
  })

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))

  // resolve nextId (pode vir com o id original que a IA usou, antes de normalizar)
  nodes.forEach(n => {
    n.options = n.options
      .map(o => {
        const resolved = o.nextIdRaw && (idMap[o.nextIdRaw] || (byId[o.nextIdRaw] ? o.nextIdRaw : null))
        return { id: o.id, keyword: o.keyword, label: o.label, nextId: resolved || null }
      })
      .filter(o => o.nextId && byId[o.nextId])
  })

  const root = nodes.find(n => n.type === 'welcome') || nodes[0]

  // Nós que já são alvo explícito de alguma opção nunca devem ser "roubados"
  // como próximo-passo automático de outro nó linear — só chegam lá pelo ramo certo.
  const claimedByOption = new Set()
  nodes.forEach(n => n.options.forEach(o => claimedByOption.add(o.nextId)))
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]))

  // Monta a árvore final: nós com options ramificam por elas; nós sem options
  // (welcome/message/transfer/end/...) avançam pro próximo nó ainda livre e não
  // visitado, seguindo a ordem em que a IA gerou a lista — assim replica o
  // comportamento real do motor de fluxo (children[0] = próximo passo linear)
  // sem perder conteúdo solto que a IA tenha gerado fora de ordem.
  const finalNodes = []
  const visited = new Set()

  function visit(node, parentId) {
    if (!node || visited.has(node.id)) return
    visited.add(node.id)

    let children
    if (node.options.length) {
      children = node.options.map(o => o.nextId)
    } else {
      let next = null
      for (let i = indexOf.get(node.id) + 1; i < nodes.length; i++) {
        const cand = nodes[i]
        if (!visited.has(cand.id) && !claimedByOption.has(cand.id)) { next = cand; break }
      }
      children = next ? [next.id] : []
    }

    finalNodes.push({
      id: node.id, type: node.type, text: node.text,
      parentId: parentId || null, children, options: node.options,
    })
    children.forEach(cid => visit(byId[cid], node.id))
  }

  visit(root, null)

  // Sobras que mesmo assim não ficaram alcançáveis (ex: alvo de opção inválida
  // que foi descartada): encadeia no fim do último nó-folha, pra não perder conteúdo.
  const unreached = nodes.filter(n => !visited.has(n.id))
  let lastLeaf = finalNodes[finalNodes.length - 1]
  unreached.forEach(n => {
    if (!lastLeaf) return
    lastLeaf.children = [...(lastLeaf.children || []), n.id]
    const leaf = { id: n.id, type: n.type, text: n.text, parentId: lastLeaf.id, children: [], options: [] }
    finalNodes.push(leaf)
    lastLeaf = leaf
  })

  return { name: 'Fluxo gerado por IA', nodes: finalNodes }
}
