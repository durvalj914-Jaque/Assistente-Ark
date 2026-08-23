import { createClient } from '@supabase/supabase-js'
import { sendText } from '../../../lib/meta'
import { canSendToB2C } from '../../../lib/messageGuard'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const auth = req.headers.authorization || ''
  const apiKey = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-api-key']
  if (!apiKey) return res.status(401).json({ error: 'missing_api_key' })

  const { to, message, type } = req.body || {}
  if (!to || !message) return res.status(400).json({ error: 'to and message are required' })

  const db = getDB()

  const { data: tenant } = await db.from('tenants').select('id, status, subscription').eq('api_key', apiKey).maybeSingle()
  if (!tenant) return res.status(401).json({ error: 'invalid_api_key' })
  if (tenant.status !== 'active') return res.status(403).json({ error: 'tenant_inactive' })

  const { data: bot } = await db.from('bots').select('*').eq('tenant_id', tenant.id).eq('status', 'active').order('created_at').limit(1).maybeSingle()
  if (!bot || !bot.phone_number_id || !bot.access_token) return res.status(409).json({ error: 'no_active_bot_connected' })

  // Buscar contato para verificação de janela
  let contact
  const { data: existingContact } = await db.from('contacts').select('id').eq('tenant_id', tenant.id).eq('phone', to).maybeSingle()
  if (existingContact) {
    contact = existingContact
  } else {
    const { data: newContact } = await db.from('contacts').insert({ tenant_id: tenant.id, phone: to }).select('id').single()
    contact = newContact
  }

  // ── VERIFICAR JANELA 24h E CRÉDITOS ──
  const msgType = type || (/cobran|pagamento|pix|fatura|boleto|comprov/i.test(message) ? 'utility' : 'utility')
  const sendCheck = await canSendToB2C(tenant.id, bot.id, contact.id, msgType)
  
  if (!sendCheck.canSend) {
    return res.status(402).json({
      error: 'window_closed_no_credits',
      message: 'A janela de 24h expirou e você não tem créditos suficientes. O cliente precisa enviar uma mensagem primeiro (abre a janela grátis) ou compre créditos no painel.',
      window_open: false,
      needs_credits: true,
      credit_type: sendCheck.credit_type,
      balance: sendCheck.balance,
      purchase_url: '/admin/marketing',
    })
  }

  // Verificar cota de conversas iniciadas (legacy)
  const month = new Date().toISOString().slice(0, 7)
  const { data: usageData } = await db.rpc('get_usage', { p_tenant_id: tenant.id, p_month: month }).single()
  const currentConversations = usageData?.business_initiated_conversations || 0

  let maxConversations = 50
  try {
    const sub = JSON.parse(tenant.subscription || '{}')
    if (sub?.status === 'active' && sub.limits?.max_conversations_month) {
      maxConversations = sub.limits.max_conversations_month
    }
  } catch {}

  // Mensagens de cobranca SEMPRE passam (geram comissao)
  const isPaymentMsg = /cobran|pagamento|pix|fatura|boleto|comprov/i.test(message)
  
  if (!isPaymentMsg && maxConversations < 999999 && currentConversations >= maxConversations) {
    return res.status(429).json({ 
      error: 'quota_exceeded', 
      message: 'Limite de conversas iniciadas atingido. Upgrade necessario para novas conversas.',
      current: currentConversations, 
      max: maxConversations,
      hint: 'Mensagens de cobranca/pagamento sao isentas do limite.'
    })
  }

  try {
    await sendText(bot.phone_number_id, bot.access_token, to, message)
  } catch (e) {
    // Se falhou por janela 24h e tem créditos, tentar template
    if (!sendCheck.window_open && sendCheck.has_credit) {
      return res.status(402).json({
        error: 'window_closed_need_template',
        message: 'A janela de 24h expirou. Mensagens fora da janela precisam de template aprovado. Use a aba Marketing para enviar broadcasts.',
        has_credits: true,
        balance: sendCheck.balance,
      })
    }
    return res.status(502).json({ error: 'whatsapp_send_failed', detail: e?.response?.data || e.message })
  }

  let { data: conv } = await db.from('conversations').select('*').eq('tenant_id', tenant.id).eq('bot_id', bot.id).eq('contact_id', contact.id).neq('status', 'closed').order('last_message_at', { ascending: false }).limit(1).maybeSingle()
  if (!conv) {
    const { data: newConv } = await db.from('conversations').insert({ tenant_id: tenant.id, bot_id: bot.id, contact_id: contact.id, status: 'human' }).select('*').single()
    conv = newConv
  }

  await db.from('messages').insert({ tenant_id: tenant.id, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', type: 'text', content: message })
  await db.from('conversations').update({ last_message: message, last_message_at: new Date().toISOString() }).eq('id', conv.id)

  // Só contar como business-initiated se a janela estava fechada (precisou de template)
  if (!sendCheck.window_open) {
    try { await db.rpc('increment_business_conversation', { p_tenant_id: tenant.id, p_month: new Date().toISOString().slice(0, 7) }) } catch (_) {}
  }

  return res.status(200).json({ ok: true, window_open: sendCheck.window_open, credit_used: !sendCheck.window_open })
}
