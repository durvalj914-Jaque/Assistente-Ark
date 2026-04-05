// pages/api/webhook/index.js
// Rota principal para verificação da Meta e recebimento de mensagens

import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'
import { processMessage } from '../../../lib/flowEngine'

export default async function handler(req, res) {
  // ── GET: verificação da Meta ─────────────────────────────────
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === 'ark_secret') {
      console.log('[webhook] Verificação Meta OK')
      return res.status(200).send(challenge)
    }
    console.log('[webhook] Verificação falhou - token inválido:', token)
    return res.status(403).end()
  }

  // ── POST: mensagem recebida ───────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body
      const entry = body?.entry?.[0]
      const change = entry?.changes?.[0]?.value
      const messages = change?.messages

      if (!messages?.length) return res.status(200).end()

      const msg = messages[0]
      const from = msg.from
      const phoneNumberId = change?.metadata?.phone_number_id
      const userText = msg.type === 'text'
        ? msg.text?.body
        : msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''

      const db = supabaseAdmin()

      // Busca bot pelo phone_number_id
      const { data: bot } = await db.from('bots')
        .select('*, tenants(id, plan, status)')
        .eq('phone_number_id', phoneNumberId)
        .eq('status', 'active')
        .single()

      if (!bot) {
        console.log('[webhook] Bot não encontrado para phone_number_id:', phoneNumberId)
        return res.status(200).end()
      }

      const tenantId = bot.tenant_id
      const month = new Date().toISOString().slice(0, 7)

      // Controle de uso
      await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: month })

      // Upsert contato
      const { data: contact } = await db.from('contacts')
        .upsert({ tenant_id: tenantId, phone: from, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,phone' })
        .select().single()

      // Busca ou cria conversa
      let { data: conv } = await db.from('conversations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contact.id)
        .neq('status', 'closed')
        .single()

      if (!conv) {
        const { data: newConv } = await db.from('conversations').insert({
          tenant_id: tenantId,
          bot_id: bot.id,
          contact_id: contact.id,
          status: 'bot'
        }).select().single()
        conv = newConv
      }

      // Salva mensagem entrada
      await db.from('messages').insert({
        tenant_id: tenantId,
        conversation_id: conv.id,
        bot_id: bot.id,
        contact_id: contact.id,
        direction: 'inbound',
        type: msg.type,
        content: userText,
        meta_message_id: msg.id
      })

      // Transferência para humano?
      if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
        await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
        await sendText(bot.phone_number_id, bot.access_token, from, '✋ Transferindo para atendimento humano. Aguarde!')
        return res.status(200).end()
      }

      // Processa fluxo
      const { reply } = await processMessage(bot, conv, userText, {
        supabase: db,
        sendFn: (text) => sendText(bot.phone_number_id, bot.access_token, from, text)
      })

      if (reply) {
        await sendText(bot.phone_number_id, bot.access_token, from, reply)
        await db.from('messages').insert({
          tenant_id: tenantId,
          conversation_id: conv.id,
          bot_id: bot.id,
          contact_id: contact.id,
          direction: 'outbound',
          type: 'text',
          content: reply
        })
        await db.from('bots').update({
          total_messages: (bot.total_messages || 0) + 2,
          updated_at: new Date().toISOString()
        }).eq('id', bot.id)
      }

      return res.status(200).end()
    } catch (err) {
      console.error('[webhook] error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).end()
}
