/**
 * POST /api/send-message
 * Envia uma mensagem manual (atendimento humano) para o contato de uma conversa.
 * Body: { conversation_id, text }
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * - Confirma que o usuário autenticado pertence ao tenant da conversa.
 * - Envia via WhatsApp usando o token do bot.
 * - Salva a mensagem (sent_by: 'human') e muda a conversa para status 'human'
 *   automaticamente (assumir o atendimento ao responder).
 */
import { supabaseAdmin } from '../../lib/supabase'
import { sendText } from '../../lib/meta'

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

  try {
    await sendText(bot.phone_number_id, token, contact.phone, text.trim())
  } catch (err) {
    console.error('[send-message] erro ao enviar WhatsApp:', err?.response?.data || err.message)
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

  return res.status(200).json({ ok: true })
}
