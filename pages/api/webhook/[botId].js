import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'
import { getRootNode, getNextNode, processMessage } from '../../../lib/flowEngine'
import { sendProductList, sendSingleProduct, retailerIdFor } from '../../../lib/metaCatalog'

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
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body
    const value = body?.entry?.[0]?.changes?.[0]?.value

    // ── Handle ORDER (pedido do catálogo pelo B2C) ──
    if (value?.orders?.length) {
      const order = value.orders[0]
      const from = order.customer?.phone || value?.messages?.[0]?.from
      await handleCatalogOrder(db, botId, order, from)
      return res.status(200).end()
    }

    const messages = value?.messages
    if (!messages?.length) return res.status(200).end()

    const msg = messages[0]
    const from = msg.from
    const userText = msg.type === 'text'
      ? msg.text?.body
      : msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || msg.interactive?.nfm_reply?.title || ''

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
    let mediaFilename = ''
    if (msg.type === 'image' && msg.image) { mediaId = msg.image.id; mediaCaption = msg.image.caption || '' }
    else if (msg.type === 'video' && msg.video) { mediaId = msg.video.id; mediaCaption = msg.video.caption || '' }
    else if (msg.type === 'document' && msg.document) { mediaId = msg.document.id; mediaCaption = msg.document.caption || ''; mediaFilename = msg.document.filename || '' }
    else if (msg.type === 'audio' && msg.audio) { mediaId = msg.audio.id }

    let displayContent = userText
    if (mediaId) {
      const caption = mediaCaption || (msg.type === 'image' ? '🖼️ Imagem' : msg.type === 'video' ? '🎬 Vídeo' : msg.type === 'audio' ? '🎵 Áudio' : msg.type === 'document' ? '📎 ' + (mediaFilename || 'Documento') : '🎟️ Sticker')
      displayContent = `__media__:${msg.type}:${mediaId}__ ${caption}`
    } else if (!displayContent) {
      displayContent = `[${msg.type}]`
    }

    // Salva mensagem entrada
    await db.from('messages').insert({
      tenant_id: tenantId,
      conversation_id: conv.id,
      bot_id: botId,
      contact_id: contact.id,
      direction: 'inbound',
      type: msg.type,
      content: displayContent,
      meta_message_id: msg.id
    })

    // Transferência para humano?
    if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
      await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
      await sendText(bot.phone_number_id, bot.access_token, from, '✋ Transferindo para atendimento humano. Aguarde um momento!')
      return res.status(200).end()
    }

    // Processa fluxo
    const result = await processMessage(bot, conv, userText, {
      supabase: db,
      sendFn: (text) => sendText(bot.phone_number_id, bot.access_token, from, text)
    })

    const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
    const phoneId = bot.phone_number_id

    // ── AÇÃO: CATÁLOGO — envia product_list nativa do WhatsApp ──
    if (result.action === 'catalog') {
      // Buscar produtos ativos do tenant
      const { data: products } = await db.from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30)

      if (products?.length) {
        try {
          // Enviar texto introdutório (se houver)
          if (result.reply) {
            await sendText(phoneId, waToken, from, result.reply)
            await db.from('messages').insert({
              tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
              contact_id: contact.id, direction: 'outbound', type: 'text', content: result.reply
            })
          }
          // Enviar product_list nativa
          await sendProductList({
            phoneNumberId: phoneId, token: waToken, to: from,
            headerText: '🛍️ Catálogo',
            bodyText: 'Toque num produto para ver detalhes e comprar 👇',
            products, tenantId
          })
          await db.from('messages').insert({
            tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
            contact_id: contact.id, direction: 'outbound', type: 'interactive',
            content: `🛍️ Catálogo enviado — ${products.length} produtos`
          })
        } catch (catErr) {
          console.error('[catalog] sendProductList failed:', catErr.message)
          // Fallback: envia lista em texto
          let fallback = '📦 *Catálogo de Produtos*\n\n'
          for (const p of products) {
            fallback += `*${p.name}*\n${p.description || ''}\n💰 R$ ${Number(p.price).toFixed(2)}\n\n`
          }
          fallback += 'Para comprar, fale com nosso atendente digitando "humano".'
          await sendText(phoneId, waToken, from, fallback)
          await db.from('messages').insert({
            tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
            contact_id: contact.id, direction: 'outbound', type: 'text', content: fallback
          })
        }
      } else {
        const noProducts = '📦 No momento não temos produtos disponíveis no catálogo. Volte em breve!'
        await sendText(phoneId, waToken, from, noProducts)
        await db.from('messages').insert({
          tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
          contact_id: contact.id, direction: 'outbound', type: 'text', content: noProducts
        })
      }

      // Atualiza stats
      await db.from('bots').update({
        total_messages: (bot.total_messages || 0) + 2,
        updated_at: new Date().toISOString()
      }).eq('id', botId)
      return res.status(200).end()
    }

    // ── AÇÃO: PAGAMENTO — gera cobrança PIX ──
    if (result.action === 'payment') {
      // TODO: implementar pagamento via fluxo
      // Por agora, só envia o texto do nó
    }

    // ── Resposta padrão (texto) ──
    if (result.reply) {
      await sendText(phoneId, waToken, from, result.reply)
      await db.from('messages').insert({
        tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
        contact_id: contact.id, direction: 'outbound', type: 'text', content: result.reply
      })
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

// ── Handler de pedido do catálogo (B2C cliente comprou) ──
async function handleCatalogOrder(db, botId, order, from) {
  const { data: bot } = await db.from('bots').select('id, tenant_id, phone_number_id, access_token').eq('id', botId).maybeSingle()
  if (!bot) return

  const tenantId = bot.tenant_id
  const catalogId = process.env.ARKIEL_META_CATALOG_ID

  // Upsert contato
  const { data: contact } = await db.from('contacts')
    .upsert({ tenant_id: tenantId, phone: from, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,phone' })
    .select().single()

  // Buscar/criar conversa
  let { data: conv } = await db.from('conversations')
    .select('*').eq('tenant_id', tenantId).eq('contact_id', contact.id).neq('status', 'closed').single()
  if (!conv) {
    const { data: newConv } = await db.from('conversations').insert({
      tenant_id: tenantId, bot_id: botId, contact_id: contact.id, status: 'bot'
    }).select().single()
    conv = newConv
  }

  // Extrair itens do pedido
  const orderItems = order.order_items || order.product_items || []
  const total = order.total || orderItems.reduce((sum, i) => sum + (Number(i.item_price) * (i.quantity || 1)), 0)

  // Salvar pedido no banco
  const { data: savedOrder } = await db.from('whatsapp_orders').insert({
    tenant_id: tenantId,
    bot_id: botId,
    contact_id: contact.id,
    conversation_id: conv.id,
    catalog_id: catalogId,
    items: orderItems.map(i => ({
      product_retailer_id: i.product_retailer_id || i.retailer_id,
      quantity: i.quantity || 1,
      item_price: Number(i.item_price || i.price || 0),
      currency: i.currency || 'BRL',
    })),
    total: Number(total),
    currency: order.currency || 'BRL',
    status: 'new',
    note: order.text || null,
  }).select().single()

  // Notificar B2C que o pedido foi recebido
  const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
  const phoneId = bot.phone_number_id
  const confirmText = `✅ *Pedido recebido!*\n\n📋 Nº: ${savedOrder?.id?.substring(0, 8) || 'N/A'}\n💰 Total: R$ ${Number(total).toFixed(2)}\n\nRecebemos seu pedido e em breve entraremos em contato para confirmar o pagamento. Obrigado! 🎉`

  await sendText(phoneId, waToken, from, confirmText)

  // Salvar mensagem de confirmação
  await db.from('messages').insert({
    tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
    contact_id: contact.id, direction: 'outbound', type: 'text', content: confirmText
  })

  // Salvar mensagem do pedido recebido
  const orderText = `🛒 *Novo pedido do catálogo*\nTotal: R$ ${Number(total).toFixed(2)}\nItens: ${orderItems.length}`
  await db.from('messages').insert({
    tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
    contact_id: contact.id, direction: 'inbound', type: 'order', content: orderText
  })
}
