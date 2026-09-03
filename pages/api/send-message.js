/**
 * POST /api/send-message
 * Envia uma mensagem manual (atendimento humano) para o contato de uma conversa.
 * Body: { conversation_id, text }
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * Regras de envio:
 * 1. Janela 24h aberta → envia texto livre (grátis)
 * 2. Janela fechada + tem créditos utility → envia via template (custa 1 crédito)
 * 3. Janela fechada + sem créditos → BLOQUEIA
 * 4. Conversa encerrada → BLOQUEIA
 */
import { supabaseAdmin } from '../../lib/supabase'
import { sendText, sendUtilityTemplate } from '../../lib/meta'
import { checkCredits, checkConversationWindow } from '../../lib/messageGuard'

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

  // ── VERIFICAR JANELA 24h ──
  const window = await checkConversationWindow(db, bot.id, contact.id)
  const messageText = text.trim()

  if (window.window_open) {
    // ── JANELA ABERTA: enviar texto livre (grátis) ──
    try {
      await sendText(bot.phone_number_id, token, contact.phone, messageText)
    } catch (err) {
      console.error('[send-message] erro ao enviar WhatsApp (janela aberta):', err?.response?.data || err.message)
      return res.status(502).json({ error: 'Falha ao enviar mensagem via WhatsApp', detail: err?.response?.data || err.message })
    }

    await saveMessage(db, conv, bot, contact, messageText)
    return res.status(200).json({ ok: true, window_open: true, method: 'free_text' })
  }

  // ── JANELA FECHADA: verificar créditos utility ──
  const credits = await checkCredits(db, conv.tenant_id, 'utility')

  if (!credits.has_credit) {
    // Sem créditos — BLOQUEAR
    return res.status(402).json({
      error: 'A janela de 24h expirou e você não tem créditos de mensagens iniciais. O cliente precisa enviar uma mensagem primeiro (abre a janela grátis) ou compre créditos no painel.',
      code: 'NO_CREDITS',
      window_open: false,
      needs_credits: true,
      credit_type: 'utility',
      balance: 0,
      purchase_url: '/admin/marketing',
    })
  }

  // ── TEM CRÉDITOS: tentar enviar texto livre primeiro ──
  // Se a Meta permitir (caso raro onde nossa checagem está desatualizada), ótimo
  // Se falhar, enviar via template hello_world (debita 1 crédito no webhook)
  try {
    await sendText(bot.phone_number_id, token, contact.phone, messageText)
    await saveMessage(db, conv, bot, contact, messageText)
    return res.status(200).json({ ok: true, window_open: false, method: 'free_text', credits_balance: credits.balance })
  } catch (freeFormErr) {
    console.log('[send-message] Texto livre falhou (janela fechada), tentando template. Erro:', freeFormErr?.response?.data?.error?.message || freeFormErr?.message)
  }

  // ── FALLBACK: enviar via template hello_world ──
  try {
    await sendUtilityTemplate(bot.phone_number_id, token, contact.phone, 'hello_world', 'en_US')

    // Salvar a mensagem original no banco (o B2B verá o que enviou)
    await saveMessage(db, conv, bot, contact, messageText)

    return res.status(200).json({
      ok: true,
      window_open: false,
      method: 'template',
      template: 'hello_world',
      credits_balance: credits.balance - 1,
      notice: 'Mensagem enviada via template. O cliente receberá uma notificação e poderá responder para abrir o chat.',
    })
  } catch (tmplErr) {
    console.error('[send-message] erro ao enviar template:', tmplErr?.response?.data || tmplErr?.message)
    return res.status(502).json({
      error: 'Falha ao enviar mensagem. A janela 24h está fechada e o envio via template também falhou.',
      code: 'SEND_FAILED',
      detail: tmplErr?.response?.data || tmplErr?.message,
      credits_balance: credits.balance,
    })
  }
}

// Helper: salvar mensagem no banco
async function saveMessage(db, conv, bot, contact, text) {
  await db.from('messages').insert({
    tenant_id: conv.tenant_id,
    conversation_id: conv.id,
    bot_id: bot.id,
    contact_id: contact.id,
    direction: 'outbound',
    type: 'text',
    content: text,
    sent_by: 'human',
  })

  const convUpdate = {
    last_message: text,
    last_message_at: new Date().toISOString(),
  }
  if (conv.status !== 'human') convUpdate.status = 'human'
  await db.from('conversations').update(convUpdate).eq('id', conv.id)
}
