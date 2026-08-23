/**
 * Verifica se o B2B pode enviar mensagem para o B2C.
 * 
 * Regras:
 * 1. Se a janela 24h está aberta (cliente mandou msg nas últimas 24h) → pode enviar grátis
 * 2. Se a janela expirou → precisa de template (pago) → verifica créditos
 * 3. Se não tem créditos → BLOQUEIA o envio
 * 4. Cobranças (payments/create) são exceção — sempre tentam enviar
 * 
 * Retorna: { canSend, reason, window_open, needs_template, has_credit, balance }
 */

import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

/**
 * Verifica se a janela de 24h está aberta para um contato.
 * A janela abre quando o B2C (cliente) envia qualquer mensagem.
 * Fecha 24h depois da última mensagem inbound do cliente.
 */
export async function checkConversationWindow(db, botId, contactId) {
  // Buscar a última mensagem inbound (do cliente) nesta conversa
  const { data: lastInbound } = await db.from('messages')
    .select('created_at')
    .eq('bot_id', botId)
    .eq('contact_id', contactId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastInbound) {
    // Cliente nunca mandou mensagem — janela fechada (precisa template)
    return { window_open: false, last_inbound_at: null, expires_at: null }
  }

  const lastInboundAt = new Date(lastInbound.created_at)
  const expiresAt = new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000) // +24h
  const now = new Date()
  const windowOpen = now < expiresAt

  return {
    window_open: windowOpen,
    last_inbound_at: lastInboundAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    hours_remaining: windowOpen ? Math.round((expiresAt - now) / (60 * 60 * 1000) * 10) / 10 : 0,
  }
}

/**
 * Verifica se o tenant tem créditos do tipo especificado.
 */
export async function checkCredits(db, tenantId, creditType) {
  const { data: creditRow } = await db.from('conversation_credits')
    .select('balance')
    .eq('tenant_id', tenantId)
    .eq('credit_type', creditType)
    .maybeSingle()

  const balance = creditRow?.balance || 0
  return { has_credit: balance > 0, balance, credit_type: creditType }
}

/**
 * Verificação completa antes de enviar mensagem B2B → B2C.
 * 
 * @param {string} tenantId - ID do tenant (B2B)
 * @param {string} botId - ID do bot
 * @param {string} contactId - ID do contato (B2C)
 * @param {string} messageType - 'utility' | 'marketing' | 'payment'
 * @returns {object} { canSend, reason, window_open, needs_template, has_credit, balance, credit_type }
 */
export async function canSendToB2C(tenantId, botId, contactId, messageType = 'utility') {
  const db = getDB()

  // 1. Verificar janela 24h
  const window = await checkConversationWindow(db, botId, contactId)

  if (window.window_open) {
    // Janela aberta → pode enviar texto grátis (sem template)
    return {
      canSend: true,
      reason: 'window_open',
      window_open: true,
      needs_template: false,
      has_credit: null,
      balance: null,
      credit_type: null,
      hours_remaining: window.hours_remaining,
    }
  }

  // 2. Janela fechada → precisa template (pago)
  // Cobranças são exceção — sempre tentam enviar (mas ainda verificam créditos)
  const creditType = messageType === 'marketing' ? 'marketing' : 'utility'
  const credits = await checkCredits(db, tenantId, creditType)

  if (credits.has_credit) {
    // Tem créditos → pode enviar template (vai debitar 1 crédito no webhook)
    return {
      canSend: true,
      reason: 'has_credits',
      window_open: false,
      needs_template: true,
      has_credit: true,
      balance: credits.balance,
      credit_type: creditType,
    }
  }

  // 3. Sem créditos e janela fechada → BLOQUEIA
  return {
    canSend: false,
    reason: 'no_credits_window_closed',
    window_open: false,
    needs_template: true,
    has_credit: false,
    balance: 0,
    credit_type: creditType,
    message: 'A janela de 24h expirou e você não tem créditos suficientes. Compre créditos no painel para continuar enviando mensagens.',
  }
}

/**
 * Verifica e bloqueia se necessário antes de enviar template.
 * Retorna { blocked: true, error } se bloqueado, ou { blocked: false } se pode enviar.
 */
export async function guardSendTemplate(tenantId, botId, contactId, messageType = 'utility') {
  const check = await canSendToB2C(tenantId, botId, contactId, messageType)

  if (!check.canSend) {
    return {
      blocked: true,
      error: check.message,
      details: check,
    }
  }

  return { blocked: false, ...check }
}
