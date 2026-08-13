/**
 * GET    /api/admin/plan-resources  — Lista recursos disponíveis (catálogo)
 * POST   /api/admin/plan-resources  — Cria um recurso
 * PATCH  /api/admin/plan-resources  — Atualiza um recurso (req.body.id)
 * DELETE /api/admin/plan-resources  — Remove um recurso (req.body.id)
 *
 * Recurso: { id, name, price, description, category }
 * Stored in: tenants JSON (Arkiel) as plan_resources[]
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

  const DEFAULT_RESOURCES = [
    { id: 'res_bot_1', name: '1 Bot Ativo', price: 49.90, description: '1 assistente de WhatsApp ativo', category: 'bot' },
    { id: 'res_bot_2', name: '2 Bots Ativos', price: 89.90, description: '2 assistentes de WhatsApp ativos', category: 'bot' },
    { id: 'res_bot_3', name: '3 Bots Ativos', price: 129.90, description: '3 assistentes de WhatsApp ativos', category: 'bot' },
    { id: 'res_bot_5', name: '5 Bots Ativos', price: 199.90, description: '5 assistentes de WhatsApp ativos', category: 'bot' },
    { id: 'res_msg_1k', name: '1.000 mensagens/mês', price: 29.90, description: 'Pacote de 1.000 mensagens por mês', category: 'mensagens' },
    { id: 'res_msg_5k', name: '5.000 mensagens/mês', price: 79.90, description: 'Pacote de 5.000 mensagens por mês', category: 'mensagens' },
    { id: 'res_msg_10k', name: '10.000 mensagens/mês', price: 149.90, description: 'Pacote de 10.000 mensagens por mês', category: 'mensagens' },
    { id: 'res_msg_50k', name: '50.000 mensagens/mês', price: 449.90, description: 'Pacote de 50.000 mensagens por mês', category: 'mensagens' },
    { id: 'res_msg_unl', name: 'Mensagens Ilimitadas', price: 299.90, description: 'Mensagens ilimitadas por mês', category: 'mensagens' },
    { id: 'res_contacts_500', name: 'Até 500 contatos', price: 19.90, description: 'Gerenciamento de até 500 contatos', category: 'contatos' },
    { id: 'res_contacts_2k', name: 'Até 2.000 contatos', price: 49.90, description: 'Gerenciamento de até 2.000 contatos', category: 'contatos' },
    { id: 'res_contacts_unl', name: 'Contatos Ilimitados', price: 99.90, description: 'Contatos e leads ilimitados', category: 'contatos' },
    { id: 'res_catalog', name: 'Catálogo de Produtos', price: 39.90, description: 'Catálogo nativo do WhatsApp com sincronização automática', category: 'integracao' },
    { id: 'res_pix', name: 'Pagamentos via PIX', price: 24.90, description: 'Geração de PIX dinâmico com confirmação automática', category: 'integracao' },
    { id: 'res_mp', name: 'Pagamentos Mercado Pago', price: 34.90, description: 'Checkout Mercado Pago (cartão, boleto) com webhook', category: 'integracao' },
    { id: 'res_flow', name: 'Flow Editor Avançado', price: 59.90, description: 'Editor visual de fluxos com nós condicionais e IA', category: 'bot' },
    { id: 'res_ai', name: 'Respostas com IA', price: 79.90, description: 'Integração com OpenAI para respostas inteligentes', category: 'integracao' },
    { id: 'res_human', name: 'Transferência para Humano', price: 29.90, description: 'Passagem de conversa para atendente humano com notificação', category: 'suporte' },
    { id: 'res_push', name: 'Notificações Web Push', price: 19.90, description: 'Notificações push no navegador quando há atendimento pendente', category: 'integracao' },
    { id: 'res_multiuser', name: 'Multiusuário (3 usuários)', price: 39.90, description: 'Até 3 usuários no painel com permissões', category: 'geral' },
    { id: 'res_multiuser_10', name: 'Multiusuário (10 usuários)', price: 89.90, description: 'Até 10 usuários no painel com permissões', category: 'geral' },
    { id: 'res_google', name: 'Importação de Contatos Google', price: 19.90, description: 'Sincronização de contatos via Google OAuth', category: 'integracao' },
    { id: 'res_storage_5', name: 'Armazenamento 5GB (mídias)', price: 24.90, description: '5GB para imagens, áudios e documentos', category: 'storage' },
    { id: 'res_storage_20', name: 'Armazenamento 20GB (mídias)', price: 79.90, description: '20GB para imagens, áudios e documentos', category: 'storage' },
    { id: 'res_storage_50', name: 'Armazenamento 50GB (mídias)', price: 149.90, description: '50GB para imagens, áudios e documentos', category: 'storage' },
    { id: 'res_reports', name: 'Relatórios Avançados', price: 49.90, description: 'Dashboards, métricas e exportação de relatórios', category: 'geral' },
    { id: 'res_support_email', name: 'Suporte por Email', price: 0, description: 'Suporte por email (até 48h resposta)', category: 'suporte' },
    { id: 'res_support_priority', name: 'Suporte Prioritário', price: 59.90, description: 'Suporte prioritário (até 4h resposta, horário comercial)', category: 'suporte' },
    { id: 'res_api', name: 'Acesso à API', price: 99.90, description: 'Acesso à API REST para integrações personalizadas', category: 'integracao' },
    { id: 'res_whatsapp_api', name: 'Número WhatsApp dedicado', price: 39.90, description: 'Número WhatsApp Business dedicado (não compartilhado)', category: 'bot' },
  ]

  async function readData() {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    try {
      const parsed = JSON.parse(tenant?.mp_access_token || '{}')
      return parsed
    } catch { return {} }
  }

  async function saveData(data) {
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', ARKIEL_TENANT_ID)
      .maybeSingle()
    let existing = {}
    try { existing = JSON.parse(tenant?.mp_access_token || '{}') } catch {}
    existing.plan_resources = data
    const { error } = await db.from('tenants')
      .update({ mp_access_token: JSON.stringify(existing) })
      .eq('id', ARKIEL_TENANT_ID)
    return !error
  }

  if (req.method === 'GET') {
    const data = await readData()
    let resources = data.plan_resources || []
    // Auto-seed default resources if none exist yet
    if (resources.length === 0) {
      resources = DEFAULT_RESOURCES
      await saveData(resources)
    }
    return res.status(200).json({ resources })

  } else if (req.method === 'POST') {
    const { name, price, description, category } = req.body
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' })
    const data = await readData()
    const resources = data.plan_resources || []
    const newRes = {
      id: crypto.randomUUID(),
      name,
      price: parseFloat(price) || 0,
      description: description || '',
      category: category || 'geral',
    }
    resources.push(newRes)
    const ok = await saveData(resources)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true, resource: newRes })

  } else if (req.method === 'PATCH') {
    const { id, name, price, description, category } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })
    const data = await readData()
    const resources = data.plan_resources || []
    const idx = resources.findIndex(r => r.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Recurso não encontrado' })
    if (name !== undefined) resources[idx].name = name
    if (price !== undefined) resources[idx].price = parseFloat(price)
    if (description !== undefined) resources[idx].description = description
    if (category !== undefined) resources[idx].category = category
    const ok = await saveData(resources)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true })

  } else if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'ID é obrigatório' })
    const data = await readData()
    const resources = (data.plan_resources || []).filter(r => r.id !== id)
    const ok = await saveData(resources)
    if (!ok) return res.status(500).json({ error: 'Erro ao salvar' })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
