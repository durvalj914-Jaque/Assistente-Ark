import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'
import { getRootNode, getNextNode, processMessage } from '../../../lib/flowEngine'

export default async function handler(req, res) {
  const { botId } = req.query
  const db = supabaseAdmin()

  // ── GET: verificação Meta ──────────────────────────────────────
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    const { data: bot } = await db.from('bots').select('webhook_verify_token').eq('id', botId).single()
    if (mode === 'subscribe' && bot && token === bot.webhook_verify_token) {
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  // ── POST: mensagem recebida ──────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body
      const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
      if (!messages?.length) return res.status(200).end()

      const msg = messages[0]
      const from = msg.from
      const userText = msg.type === 'text'
        ? msg.text?.body
        : msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''

      // Busca bot + tenant
      const { data: bot } = await db.from('bots')
        .select('*, tenants(id, plan, status)')
        .eq('id', botId)
        .single()

      if (!bot || bot.status !== 'active' || bot.tenants?.status !== 'active') {
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
          bot_id: botId,
          contact_id: contact.id,
          status: 'bot'
        }).select().single()
        conv = newConv
      }

      // Extrair mídia
      let mediaId = null
      let mediaCaption = ''
      if (msg.type === 'image' && msg.image) { mediaId = msg.image.id; mediaCaption = msg.image.caption || '' }
      else if (msg.type === 'video' && msg.video) { mediaId = msg.video.id; mediaCaption = msg.video.caption || '' }
      else if (msg.type === 'document' && msg.document) { mediaId = msg.document.id; mediaCaption = msg.document.caption || '' }
      else if (msg.type === 'audio' && msg.audio) { mediaId = msg.audio.id }

      // Texto exibido
      let displayContent = userText
      if (!displayContent && msg.type === 'image') displayContent = mediaCaption || '🖼️ Imagem'
      else if (!displayContent && msg.type === 'video') displayContent = mediaCaption || '🎬 Vídeo'
      else if (!displayContent && msg.type === 'document') displayContent = mediaCaption || '📎 Documento'
      else if (!displayContent && msg.type === 'audio') displayContent = '🎵 Áudio'
      else if (!displayContent) displayContent = `[${msg.type}]`

      // Salva mensagem entrada
      await db.from('messages').insert({
        tenant_id: tenantId,
        conversation_id: conv.id,
        bot_id: botId,
        contact_id: contact.id,
        direction: 'inbound',
        type: msg.type,
        content: displayContent,
        meta_message_id: msg.id,
        media_id: mediaId,
        media_caption: mediaCaption || null
      })

      // Transferência para humano?
      if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
        await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
        await sendText(bot.phone_number_id, bot.access_token, from, '✋ Transferindo para atendimento humano. Aguarde um momento!')
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
          bot_id: botId,
          contact_id: contact.id,
          direction: 'outbound',
          type: 'text',
          content: reply
        })
        // Atualiza stats do bot
        await db.from('bots').update({
          total_messages: (bot.total_messages || 0) + 2,
          updated_at: new Date().toISOString()
        }).eq('id', botId)
      }

      return res.status(200).end()
    } catch (err) {
      console.error('[webhook] error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).end()
}
