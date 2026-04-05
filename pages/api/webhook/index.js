import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'
import { processMessage } from '../../../lib/flowEngine'

export default async function handler(req, res) {
  // ── GET: verificação da Meta ─────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    const valid     = process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret'

    if (mode === 'subscribe' && token === valid) {
      console.log('[webhook] Verificação Meta OK')
      return res.status(200).send(challenge)
    }
    console.log('[webhook] Token inválido:', token)
    return res.status(403).end()
  }

  // ── POST: mensagem recebida ───────────────────────────────────
  if (req.method === 'POST') {
    // Sempre responde 200 primeiro para a Meta não retentar
    res.status(200).end()

    try {
      const body         = req.body
      const entry        = body?.entry?.[0]
      const change       = entry?.changes?.[0]?.value
      const messages     = change?.messages
      if (!messages?.length) return

      const msg           = messages[0]
      const from          = msg.from
      const phoneNumberId = change?.metadata?.phone_number_id
      const userText      = msg.type === 'text'
        ? msg.text?.body
        : msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''

      const db = supabaseAdmin()

      // Busca bot pelo phone_number_id
      const { data: bot } = await db
        .from('bots')
        .select('*, tenants(id, plan, status, max_messages_month)')
        .eq('phone_number_id', phoneNumberId)
        .eq('status', 'active')
        .single()

      if (!bot) {
        console.log('[webhook] Bot não encontrado para phone_number_id:', phoneNumberId)
        return
      }

      // Tenant suspenso?
      if (bot.tenants?.status !== 'active') {
        console.log('[webhook] Tenant suspenso:', bot.tenant_id)
        return
      }

      const tenantId = bot.tenant_id
      const month    = new Date().toISOString().slice(0, 7)

      // Controle de limite de mensagens
      const { data: usageRow } = await db
        .from('usage')
        .select('messages')
        .eq('tenant_id', tenantId)
        .eq('month', month)
        .single()

      const maxMsg = bot.tenants?.max_messages_month || 1000
      const usedMsg = usageRow?.messages || 0

      if (usedMsg >= maxMsg) {
        console.log('[webhook] Limite de mensagens atingido para tenant:', tenantId)
        await sendText(bot.phone_number_id, bot.access_token, from,
          '⚠️ Limite de mensagens do plano atingido. Entre em contato com o suporte.')
        return
      }

      // Incrementa uso
      await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: month })

      // Upsert contato
      const { data: contact } = await db
        .from('contacts')
        .upsert(
          { tenant_id: tenantId, phone: from, updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id,phone' }
        )
        .select()
        .single()

      // Busca ou cria conversa ativa
      let { data: conv } = await db
        .from('conversations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contact.id)
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!conv) {
        const { data: newConv } = await db
          .from('conversations')
          .insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' })
          .select()
          .single()
        conv = newConv
      }

      // Salva mensagem de entrada
      await db.from('messages').insert({
        tenant_id:       tenantId,
        conversation_id: conv.id,
        bot_id:          bot.id,
        contact_id:      contact.id,
        direction:       'inbound',
        type:            msg.type,
        content:         userText,
        meta_message_id: msg.id
      })

      // Conversa em atendimento humano? Para o bot
      if (conv.status === 'human') {
        console.log('[webhook] Conversa em atendimento humano, bot silenciado')
        return
      }

      // Keyword de transferência humana
      if (bot.human_takeover_keyword &&
          userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
        await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
        await sendText(bot.phone_number_id, bot.access_token, from,
          '✋ Transferindo para atendimento humano. Aguarde um momento!')
        return
      }

      // Processa fluxo
      const { reply } = await processMessage(bot, conv, userText, {
        supabase: db,
        sendFn: (text) => sendText(bot.phone_number_id, bot.access_token, from, text)
      })

      if (reply) {
        await sendText(bot.phone_number_id, bot.access_token, from, reply)
        await db.from('messages').insert({
          tenant_id:       tenantId,
          conversation_id: conv.id,
          bot_id:          bot.id,
          contact_id:      contact.id,
          direction:       'outbound',
          type:            'text',
          content:         reply
        })
        await db.from('bots')
          .update({ total_messages: (bot.total_messages || 0) + 2, updated_at: new Date().toISOString() })
          .eq('id', bot.id)
      }
    } catch (err) {
      console.error('[webhook] Erro interno (silenciado para Meta):', err.message)
    }

    return
  }

  res.status(405).end()
}
