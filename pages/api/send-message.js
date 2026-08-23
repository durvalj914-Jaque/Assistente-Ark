/**
 * POST /api/send-message
 * Envia uma mensagem manual (atendimento humano) para o contato de uma conversa.
 * Body: { conversation_id, text }
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * - Confirma que o usuário autenticado pertence ao tenant da conversa.
 * - Verifica janela 24h: se aberta, envia grátis. Se fechada, bloqueia sem créditos.
 * - Envia via WhatsApp usando o token do bot.
 * - Salva a mensagem (sent_by: 'human') e muda a conversa para status 'human'
 */
import { supabaseAdmin } from '../../lib/supabase'
import { sendText } from '../../lib/meta'
import { canSendToB2C } from '../../lib/messageGuard'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversation_id, text } = req.body || {}
  if (!conversation_id || !text?.trim()) {
    return res.status(400).json({ error: 'conversation_id e text são obrigatórios' })
  }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  // Busca conversa + bot + contato
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('*, bots(id, phone_number_id, access_token), contacts(id, phone)')
    .eq('id', conversation_id)
    .single()

  if (convErr || !conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // Confirma que o usuário pertence ao tenant da conversa
  const { data: member } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', conv.tenant_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a esta conversa' })

  if (conv.status === 'closed') {
    return res.status(400).json({ error: 'Esta conversa está encerrada' })
  }

  const bot = conv.bots
  const contact = conv.contacts
  const token = bot?.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2 || process.env.WHATSAPP_ACCESS_TOKEN

  if (!bot?.phone_number_id || !contact?.phone || !token) {
    return res.status(500).json({ error: 'Configuração do bot incompleta para envio' })
  }

  // ── VERIFICAR JANELA 24h, INBOUND E CRÉDITOS ──
  // 1. Verificar se o cliente já enviou alguma mensagem (inbound)
  const { data: inboundMessages } = await db.from('messages')
    .select('id, created_at')
    .eq('conversation_id', conv.id)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!inboundMessages) {
    // Cliente nunca mandou mensagem — bloquear no plano free
    // Verificar se é plano free
    let isFreePlan = true
    try {
      const sub = JSON.parse(conv.tenant?.subscription || '{}') || JSON.parse((await db.from('tenants').select('subscription, plan').eq('id', conv.tenant_id).maybeSingle()).data?.subscription || '{}')
      if (sub?.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())) {
        isFreePlan = false
      }
    } catch {}
    try {
      const { data: tenantData } = await db.from('tenants').select('plan, subscription').eq('id', conv.tenant_id).maybeSingle()
      const sub = JSON.parse(tenantData?.subscription || '{}')
      if (sub?.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())) {
        isFreePlan = false
      } else if (tenantData?.plan && tenantData.plan !== 'free') {
        isFreePlan = false
      }
    } catch {}

    if (isFreePlan) {
      return res.status(402).json({
        error: 'O cliente ainda não iniciou esta conversa. No plano gratuito, você só pode responder após o cliente enviar a primeira mensagem.',
        code: 'NO_INBOUND_FREE_PLAN',
        window_open: false,
        needs_inbound: true,
      })
    }
  }

  // 2. Verificar janela 24h e créditos
  const sendCheck = await canSendToB2C(conv.tenant_id, bot.id, contact.id, 'utility')
  if (!sendCheck.canSend) {
    return res.status(402).json({
      error: 'A janela de 24h expirou e você não tem créditos de mensagens iniciais. O cliente precisa enviar uma mensagem primeiro (abre a janela grátis) ou compre créditos no painel de Marketing.',
      code: 'WINDOW_CLOSED_NO_CREDITS',
      window_open: false,
      needs_credits: true,
      credit_type: 'utility',
      balance: sendCheck.balance,
      purchase_url: '/admin/marketing',
    })
  }

  // Se a janela está fechada mas tem créditos, avisa que vai usar template
  if (!sendCheck.window_open && sendCheck.needs_template) {
    // Para mensagens manuais, tentar enviar texto mesmo (pode falhar se janela fechada)
    // Mas o cliente tem créditos, então se falhar, tentar template
    console.log('[send-message] Janela fechada, tenant tem', sendCheck.balance, 'créditos')
  }

  try {
    await sendText(bot.phone_number_id, token, contact.phone, text.trim())
  } catch (err) {
    console.error('[send-message] erro ao enviar WhatsApp:', err?.response?.data || err.message)
    
    // Se erro for por janela 24h e tem créditos, tentar template
    if (!sendCheck.window_open && sendCheck.has_credit) {
      return res.status(402).json({
        error: 'A janela de 24h expirou. Mensagens manuais fora da janela precisam de template aprovado. Use a aba Marketing para enviar broadcasts ou aguarde o cliente enviar uma mensagem.',
        code: 'WINDOW_CLOSED_NEED_TEMPLATE',
        has_credits: true,
        balance: sendCheck.balance,
      })
    }
    
    return res.status(502).json({ error: 'Falha ao enviar mensagem via WhatsApp', detail: err?.response?.data || err.message })
  }

  await db.from('messages').insert({
    tenant_id: conv.tenant_id,
    conversation_id: conv.id,
    bot_id: bot.id,
    contact_id: contact.id,
    direction: 'outbound',
    type: 'text',
    content: text.trim(),
    sent_by: 'human'
  })

  // Responder manualmente assume o atendimento — muda para modo humano se ainda não estiver.
  const convUpdate = {
    last_message: text.trim(),
    last_message_at: new Date().toISOString()
  }
  if (conv.status !== 'human') convUpdate.status = 'human'

  await db.from('conversations').update(convUpdate).eq('id', conv.id)

  return res.status(200).json({ ok: true, window_open: sendCheck.window_open })
}
