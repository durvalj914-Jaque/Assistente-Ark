// ── Registro de provedores de IA + chamada unificada (aba "IA") ────────────
// A plataforma é gratuita: cada B2B usa a própria chave API do provedor que
// preferir. A maioria dos provedores expõe API compatível com OpenAI
// (POST /chat/completions), o que nos deixa oferecer 12 provedores com 3
// adaptadores: 'openai', 'anthropic' e 'gemini'.

export const AI_PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    mode: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'A mais popular. Modelo gpt-4.1-mini tem ótimo custo-benefício.',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    mode: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Tem camada gratuita generosa no AI Studio — dá pra ter IA de graça.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    mode: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    models: ['claude-3-5-haiku-latest', 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Claude é referência em escrita natural e simpatia no atendimento.',
  },
  {
    id: 'groq',
    label: 'Groq',
    mode: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'],
    keyUrl: 'https://console.groq.com/keys',
    note: 'Respostas quase instantâneas e tier gratuito — ótima primeira opção.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    mode: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    models: ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-001', 'anthropic/claude-3.5-haiku', 'openai/gpt-4.1-mini'],
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Uma chave, centenas de modelos — inclusive vários gratuitos.',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    mode: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    note: 'Europeia, rápida e com experimento gratuito no La Plateforme.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    mode: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Preço agressivo e raciocínio forte.',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    mode: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    models: ['grok-3-mini', 'grok-3', 'grok-2-1212'],
    keyUrl: 'https://console.x.ai',
    note: 'Modelos Grok, da xAI.',
  },
  {
    id: 'together',
    label: 'Together AI',
    mode: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
    keyUrl: 'https://api.together.ai/settings/api-keys',
    note: 'Modelos open-source baratos com créditos iniciais.',
  },
  {
    id: 'perplexity',
    label: 'Perplexity (com busca)',
    mode: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    models: ['sonar', 'sonar-pro', 'sonar-reasoning'],
    keyUrl: 'https://www.perplexity.ai/settings/api',
    note: 'Responde com busca na web em tempo real — bom pra dúvidas gerais.',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    mode: 'openai',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    defaultModel: 'command-a-03-2025',
    models: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024'],
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    note: 'Forte em RAG e instruções longas; tem tier de teste gratuito.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local / própria infra)',
    mode: 'openai',
    baseUrl: '',
    defaultModel: 'llama3.1',
    models: ['llama3.1', 'qwen2.5', 'phi4'],
    keyUrl: 'https://ollama.com',
    note: 'IA rodando no SEU servidor, custo zero por mensagem. Requer URL pública do seu Ollama.',
    needsBaseUrl: true,
  },
]

export function getProvider(id) {
  return AI_PROVIDERS.find(p => p.id === id) || null
}

export function providerBaseUrl(p, customBaseUrl) {
  if (p.id === 'ollama') {
    const base = (customBaseUrl || '').trim().replace(/\/+$/, '')
    if (!base) throw new Error('URL do servidor Ollama é obrigatória')
    return `${base}/v1`
  }
  return p.baseUrl
}

// ── Chamada unificada ──────────────────────────────────────────────────────
// messages: [{ role: 'system'|'user'|'assistant', content: string }]
export async function callAI({ provider, apiKey, model, messages, temperature = 0.4, maxTokens = 600, customBaseUrl }) {
  const p = getProvider(provider)
  if (!p) throw new Error(`Provedor "${provider}" não suportado`)
  const useModel = model || p.defaultModel

  if (p.mode === 'gemini') return callGemini({ p, apiKey, model: useModel, messages, temperature, maxTokens })
  if (p.mode === 'anthropic') return callAnthropic({ p, apiKey, model: useModel, messages, temperature, maxTokens })
  return callOpenAICompatible({ p, apiKey, model: useModel, messages, temperature, maxTokens, customBaseUrl })
}

async function callOpenAICompatible({ p, apiKey, model, messages, temperature, maxTokens, customBaseUrl }) {
  const url = `${providerBaseUrl(p, customBaseUrl)}/chat/completions`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter recomenda esses headers
      ...(p.id === 'openrouter' ? { 'HTTP-Referer': 'https://www.assistente-ark.com.br', 'X-Title': 'Assistente Ark' } : {}),
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || data?.message || `Erro ${r.status} ao chamar ${p.label}`)
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error(`${p.label} não retornou texto`)
  return text
}

async function callAnthropic({ p, apiKey, model, messages, temperature, maxTokens }) {
  // Anthropic aceita apenas um system block + alternância user/assistant
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const chat = []
  for (const m of messages) {
    if (m.role === 'system') continue
    if (chat.length && chat[chat.length - 1].role === m.role) chat[chat.length - 1].content += `\n\n${m.content}`
    else chat.push({ role: m.role, content: m.content })
  }
  if (!chat.length || chat[0].role !== 'user') chat.unshift({ role: 'user', content: 'Olá' })
  const r = await fetch(`${p.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, system: system || undefined, messages: chat, max_tokens: maxTokens, temperature }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `Erro ${r.status} ao chamar ${p.label}`)
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  if (!text) throw new Error(`${p.label} não retornou texto`)
  return text
}

async function callGemini({ p, apiKey, model, messages, temperature, maxTokens }) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  const r = await fetch(`${p.baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.message || `Erro ${r.status} ao chamar ${p.label}`)
  const text = data.candidates?.[0]?.content?.parts?.map(x => x.text).join('').trim()
  if (!text) throw new Error(`${p.label} não retornou texto`)
  return text
}

// Teste rápido de conectividade (aba IA → botão "Testar conexão")
export async function testProviderConnection({ provider, apiKey, model, customBaseUrl }) {
  const t0 = Date.now()
  const text = await callAI({
    provider, apiKey, model, customBaseUrl,
    messages: [
      { role: 'system', content: 'Responda com exatamente: ok' },
      { role: 'user', content: 'ping' },
    ],
    temperature: 0, maxTokens: 10,
  })
  return { ok: true, latency_ms: Date.now() - t0, sample: (text || '').substring(0, 40) }
}
