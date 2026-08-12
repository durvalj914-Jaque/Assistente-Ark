import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'
import { getRootNode, getNextNode, processMessage } from '../../../lib/flowEngine'
import { sendProductList, sendSingleProduct, sendProductRich, sendProductListFallback, retailerIdFor } from '../../../lib/metaCatalog'


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
      .select('*, tenants(id, plan, status, pix_key, merchant_name, merchant_city)')
      .eq('id', botId)
      .single()

    if (!bot || bot.status !== 'active' || bot.tenants?.status !== 'active') {
      return res.status(200).end()
    }

    const tenantId = bot.tenant_id
    const tenant = bot.tenants
    const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
    const phoneId = bot.phone_number_id
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

    // ── Botão "Comprar" do catálogo (fallback rico) ──
    const buttonId = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || ''
    if (buttonId.startsWith('buy_') || buttonId.startsWith('prod_')) {
      const productId = buttonId.replace('buy_', '').replace('prod_', '')
      const { data: product } = await db.from('products')
        .select('*').eq('id', productId).eq('tenant_id', tenantId).maybeSingle()

      if (product) {
        const price = Number(product.price || 0).toFixed(2).replace('.', ',')
        const pixInfo = tenant?.pix_key ? `1️⃣ Pague via PIX: *${tenant.pix_key}*` : '1️⃣ Entre em contato para pagamento'
        const buyText = `🛒 *${product.name}* — R$ ${price}\n\n${product.description || ''}\n\nPara finalizar sua compra:\n\n${pixInfo}\n2️⃣ Envie o comprovante aqui mesmo\n\nOu fale com um atendente: digite *humano*`

        await sendText(phoneId, waToken, from, buyText)
        await db.from('messages').insert({
          tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
          contact_id: contact.id, direction: 'outbound', type: 'text', content: buyText
        })

        // Salvar pedido
        await db.from('whatsapp_orders').insert({
          tenant_id: tenantId, bot_id: botId, contact_id: contact.id,
          conversation_id: conv.id,
          items: [{ product_retailer_id: retailerIdFor(tenantId, product.id), quantity: 1, item_price: parseFloat(product.price), currency: 'BRL', product_name: product.name }],
          total: parseFloat(product.price),
          currency: 'BRL',
          status: 'new',
        })

        await db.from('bots').update({
          total_messages: (bot.total_messages || 0) + 2,
          updated_at: new Date().toISOString()
        }).eq('id', botId)
        return res.status(200).end()
      }
    }

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

    // ── AÇÃO: CATÁLOGO — envia catálogo nativo ou fallback rico ──
    if (result.action === 'catalog') {
      // Buscar produtos ativos do tenant
      const { data: products } = await db.from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(30)

      if (products?.length) {
        // Texto introdutório (se houver)
        if (result.reply) {
          await sendText(phoneId, waToken, from, result.reply)
          await db.from('messages').insert({
            tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
            contact_id: contact.id, direction: 'outbound', type: 'text', content: result.reply
          })
        }

        let sentNative = false
        // Tenta catálogo nativo primeiro
        try {
          await sendProductList({
            phoneNumberId: phoneId, token: waToken, to: from,
            headerText: '🛍️ Catálogo',
            bodyText: 'Toque num produto para ver detalhes e comprar 👇',
            products, tenantId
          })
          sentNative = true
          await db.from('messages').insert({
            tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
            contact_id: contact.id, direction: 'outbound', type: 'interactive',
            content: `🛍️ Catálogo nativo enviado — ${products.length} produtos`
          })
        } catch (catErr) {
          console.error('[catalog] Nativo falhou, usando fallback rico:', catErr.message?.substring(0, 100))
        }

        // Fallback: envia cada produto como imagem + botão de compra
        if (!sentNative) {
          for (let i = 0; i < Math.min(products.length, 5); i++) {
            try {
              await sendProductRich({
                phoneNumberId: phoneId, token: waToken, to: from,
                product: products[i], index: i, total: Math.min(products.length, 5)
              })
            } catch (_) {}
            // Pequeno delay entre produtos
            await new Promise(r => setTimeout(r, 300))
          }
          if (products.length > 5) {
            await sendText(phoneId, waToken, from, `📱 Mais ${products.length - 5} produtos disponíveis. Acesse: arkiel.com.br/catalog/${tenantId}`)
          }
          await db.from('messages').insert({
            tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
            contact_id: contact.id, direction: 'outbound', type: 'interactive',
            content: `🛍️ Catálogo enviado (fallback rico) — ${Math.min(products.length, 5)} produtos`
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

  const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
  const phoneId = bot.phone_number_id
  const orderId = savedOrder?.id?.substring(0, 8) || 'N/A'
  const totalFmt = Number(total).toFixed(2).replace('.', ',')

  // Gerar PIX dinâmico + link de checkout via Mercado Pago
  // Prioriza token do tenant, fallback para token da plataforma
  const { data: tenantPay } = await db.from('tenants').select('mp_access_token').eq('id', tenantId).maybeSingle()
  let mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
  let usingTenantToken = false
  let mpMethods = { pix: true, credit_card: true, debit_card: true, boleto: true }
  if (tenantPay?.mp_access_token) {
    try {
      const parsed = JSON.parse(tenantPay.mp_access_token)
      if (parsed.access_token) {
        mpToken = parsed.access_token
        usingTenantToken = true
      }
      if (parsed.mp_methods) mpMethods = parsed.mp_methods
    } catch {
      // Not JSON, use as plain token
      mpToken = tenantPay.mp_access_token
      usingTenantToken = true
    }
  }
  let pixCreated = false
  let pixCopyPaste = null
  let checkoutUrl = null

  if (mpToken && savedOrder) {
    try {
      // 1. Criar PIX dinâmico (apenas se ativo)
      if (mpMethods.pix) {
      const idempotencyKey = `arkiel-${savedOrder.id}`
      const pixRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          transaction_amount: Number(total),
          description: `Pedido Arkiel #${orderId}`,
          payment_method_id: 'pix',
          payer: { email: `cliente${from.slice(-4)}@arkiel.com.br` },
          metadata: { order_id: savedOrder.id, tenant_id: tenantId },
          notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
          ...(usingTenantToken ? { marketplace: 'ARKIEL', marketplace_fee: Number((orderTotal * 0.02).toFixed(2)) } : {})
        })
      })
      const pixData = await pixRes.json()

      if (pixData.id && pixData.point_of_interaction?.transaction_data?.qr_code) {
        pixCreated = true
        pixCopyPaste = pixData.point_of_interaction.transaction_data.qr_code

        // Salvar payment_id no campo note (JSON)
        await db.from('whatsapp_orders').update({
          status: 'pending_payment',
          note: JSON.stringify({ payment_id: String(pixData.id), payment_method: 'pix_mercadopago' })
        }).eq('id', savedOrder.id)
      }

      }

      // 2. Criar link de checkout (cartão, boleto) — apenas se algum metodo cartao/boleto ativo
      if (mpMethods.credit_card || mpMethods.debit_card || mpMethods.boleto) {
      const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [{
            id: savedOrder.id,
            title: `Pedido Arkiel #${orderId}`,
            quantity: 1,
            unit_price: Number(total),
            currency_id: 'BRL'
          }],
          metadata: { order_id: savedOrder.id, tenant_id: tenantId },
          notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
          ...(usingTenantToken ? { marketplace: 'ARKIEL', marketplace_fee: Number((orderTotal * 0.02).toFixed(2)) } : {}),
          back_urls: {
            success: 'https://arkiel.com.br/payment/success',
            failure: 'https://arkiel.com.br/payment/failure'
          },
          auto_return: 'approved'
        })
      })
      const prefData = await prefRes.json()
      if (prefData.init_point) {
          checkoutUrl = prefData.init_point
        }
      } // end checkout methods check
    } catch (mpErr) {
      console.error('[catalog] Erro Mercado Pago:', mpErr.message?.substring(0, 100))
    }
  }

  // Enviar confirmação do pedido
  const confirmText = `✅ *Pedido recebido!*

📋 Nº: ${orderId}
💰 Total: R$ ${totalFmt}`
  await sendText(phoneId, waToken, from, confirmText)

  if (pixCreated && pixCopyPaste) {
    // Montar mensagem com PIX + link de checkout (enviar primeiro!)
    let payText = `💳 *Escolha como pagar:*
\n💰 Valor: R$ ${totalFmt}\n`
    
    if (mpMethods.pix && pixCopyPaste) {
      payText += `\n🟢 *PIX (Copia e Cola):*\n${pixCopyPaste}\n\n✅ Confirmação automática após pagamento`
    }
    
    if (checkoutUrl) {
      let methodsList = []
      if (mpMethods.credit_card) methodsList.push('cartão de crédito')
      if (mpMethods.debit_card) methodsList.push('cartão de débito')
      if (mpMethods.boleto) methodsList.push('boleto')
      const methodsStr = methodsList.join(', ')
      payText += `\n\n📱 *Pagar com ${methodsStr}:*\n${checkoutUrl}\n\nLink seguro do Mercado Pago.`
    }

    payText += `

❓ Dúvidas? Digite *humano*`

    await sendText(phoneId, waToken, from, payText)

    // Salvar mensagem de pagamento
    await db.from('messages').insert({
      tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
      contact_id: contact.id, direction: 'outbound', type: 'text', content: payText
    })

    // Enviar QR Code como imagem via URL publica (apenas se PIX ativo)
    if (mpMethods.pix && pixCopyPaste) {
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(pixCopyPaste)}`
        const imgRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: from,
            type: 'image',
            image: { link: qrUrl, caption: `Escaneie para pagar via PIX - R$ ${totalFmt}` }
          })
        })
        const imgData = await imgRes.json()
        if (imgData.messages) {
          await db.from('messages').insert({
            tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
            contact_id: contact.id, direction: 'outbound', type: 'image',
            content: `QR Code PIX - R$ ${totalFmt}`
          })
        }
      } catch (imgErr) {
        console.error('[catalog] Erro QR (nao critico):', imgErr.message?.substring(0, 80))
      }
    }
  } else {
    // Fallback: chave PIX manual
    const { data: tenant } = await db.from('tenants').select('pix_key').eq('id', tenantId).maybeSingle()
    if (tenant?.pix_key) {
      await sendText(phoneId, waToken, from, `Para pagar:

1️⃣ PIX: ${tenant.pix_key}
2️⃣ Valor: R$ ${totalFmt}
3️⃣ Envie o comprovante aqui`)
      await db.from('whatsapp_orders').update({ status: 'pending_payment' }).eq('id', savedOrder.id)
    } else {
      await sendText(phoneId, waToken, from, 'Recebemos seu pedido! Em breve entraremos em contato. 🎉')
    }
  }

  // Salvar mensagem de confirmação
  await db.from('messages').insert({
    tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
    contact_id: contact.id, direction: 'outbound', type: 'text', content: confirmText
  })

  // Salvar mensagem do pedido recebido
  const orderText = `🛒 *Novo pedido do catálogo*
Total: R$ ${totalFmt}
Itens: ${orderItems.length}`
  await db.from('messages').insert({
    tenant_id: tenantId, conversation_id: conv.id, bot_id: botId,
    contact_id: contact.id, direction: 'inbound', type: 'order', content: orderText
  })
}
