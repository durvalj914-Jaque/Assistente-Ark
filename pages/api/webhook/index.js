import { createClient } from '@supabase/supabase-js'
import { processFlow } from '../../../lib/flowEngine'
import { sendPushToTenant } from '../../../lib/webpush'
import { sendFcmToTenant } from '../../../lib/fcm'
import { sendProductList } from '../../../lib/metaCatalog'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const PHONE_ID  = process.env.WHATSAPP_PHONE_ID || '1055720357624339'
const WA_TOKEN  = process.env.WHATSAPP_ACCESS_TOKEN
const VERIFY_TK = process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025'

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

async function savelog(db, step, error, payload) {
  try {
    await db.from('webhook_logs').insert({ step, error: error ? String(error) : '', payload: payload || null })
  } catch(_) {}
}

async function safeInsert(db, table, data) {
  try { await db.from(table).insert(data) } catch(_) {}
}

async function handleOrder(db, msg, from, phoneNumberId) {
  const order = msg.order
  if (!order) return
  const { data: botArr } = await db.from('bots').select('id,tenant_id,name,phone_number_id,access_token').eq('phone_number_id', phoneNumberId).eq('status', 'active').limit(1)
  const bot = botArr?.[0]
  if (!bot) return

  const { data: contact } = await db.from('contacts').select('id,phone,name').eq('tenant_id', bot.tenant_id).eq('phone', from).maybeSingle()

  const total = (order.product_items || []).reduce((sum, it) => sum + (Number(it.item_price || 0) * Number(it.quantity || 1)), 0)
  const currency = order.product_items?.[0]?.currency || 'BRL'

  // Salvar o pedido
  const { data: orderRow } = await db.from('whatsapp_orders').insert({
    tenant_id: bot.tenant_id, bot_id: bot.id, contact_id: contact?.id || null,
    catalog_id: order.catalog_id, items: order.product_items || [], total, currency,
    note: order.text || null, status: total > 0 ? 'awaiting_payment' : 'new',
  }).select().single()

  const orderId = orderRow?.id

  // Criar comprovante automático de pedido do catálogo (B2C Catálogo)
  if (total > 0) {
    await safeInsert(db, 'payment_receipts', {
      tenant_id: bot.tenant_id,
      conversation_id: null,
      contact_id: contact?.id || null,
      file_url: null,
      file_type: 'catalog_order',
      file_name: `Pedido Catálogo - ${new Date().toLocaleString('pt-BR')}`,
      uploaded_by: contact?.phone || from,
      notes: `Pedido via catálogo WhatsApp — ${order.product_items?.length || 0} item(ns) — Total: R$ ${total.toFixed(2)}`,
      metadata: { catalog_id: order.catalog_id, items: order.product_items, total, currency, auto: true, order_id: orderId },
      category: 'b2c_catalog',
    })
  }

  // Notificar admin
  try {
    const pushPayload = {
      title: '🛒 Novo pedido recebido!',
      body: `${contact?.name || from} enviou um carrinho de R$ ${total.toFixed(2)} pelo ${bot.name}`,
      url: '/painel?tab=receipts',
      tag: `ark-order-${from}-${Date.now()}`,
    }
    await Promise.all([sendPushToTenant(bot.tenant_id, pushPayload), sendFcmToTenant(bot.tenant_id, pushPayload)])
  } catch (_) {}

  // ── CHECKOUT AUTOMÁTICO: enviar PIX ao cliente ──
  if (total > 0) {
    try {
      const { data: tenant } = await db.from('tenants').select('pix_key, merchant_name, merchant_city, name, mp_access_token').eq('id', bot.tenant_id).maybeSingle()
      const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
      const txid = `ARK${Date.now().toString(36).toUpperCase()}`

      // Criar registro de pagamento vinculado ao pedido
      const meta = JSON.stringify({ txid, from_catalog: true, order_id: orderId, items: order.product_items, contact_id: contact?.id || null, method: 'pix', description: `Pedido catálogo - ${order.product_items?.length || 0} item(ns)` })
      const { data: payment } = await db.from('payments').insert({
        tenant_id: bot.tenant_id, bot_id: bot.id,
        amount: total,
        status: 'pending', pix_code: txid, pix_qr_url: meta,
      }).select().single()

      // O vínculo payment→order fica em payments.metadata.order_id (não precisa de coluna extra)

      const hasPix = tenant?.pix_key
      const hasMp = tenant?.mp_access_token || process.env.MERCADOPAGO_ACCESS_TOKEN

      // Enviar confirmação do pedido
      const itemCount = order.product_items?.length || 0
      await sendText(phoneNumberId, waToken, from, `🛒 *Pedido recebido!*

${itemCount} item(ns) — *Total: R$ ${total.toFixed(2)}*

Vamos finalizar o pagamento 👇`)

      if (hasPix) {
        // ── PIX automático ──
        const { generatePixCode } = await import('../../../lib/pix')
        const QRCodeModule = await import('qrcode')

        const pixCode = generatePixCode({
          pixKey: tenant.pix_key,
          merchantName: (tenant.merchant_name || tenant.name || 'Arkiel').substring(0, 25),
          merchantCity: (tenant.merchant_city || 'SAO PAULO').substring(0, 15),
          amount: total, txid,
        })
        const qrBuffer = await QRCodeModule.default.toBuffer(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        const blob = new Blob([qrBuffer], { type: 'image/png' })
        const formData = new FormData()
        formData.append('messaging_product', 'whatsapp')
        formData.append('type', 'image/png')
        formData.append('file', blob, 'pix_order.png')
        const upRes = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${waToken}` }, body: formData })
        const upJson = await upRes.json()

        if (upJson.id) {
          await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
            body: JSON.stringify({
              messaging_product: 'whatsapp', to: from, type: 'image',
              image: { id: upJson.id, caption: `💰 *Pagamento do Pedido*\n\nTotal: R$ ${total.toFixed(2)}\n\n*Escaneie o QR Code ou copie: *\n\n${pixCode}` },
            }),
          })
          const oldMeta2 = JSON.parse(payment?.pix_qr_url || '{}')
          await db.from('payments').update({ pix_code: pixCode, pix_qr_url: JSON.stringify({ ...oldMeta2, qr_media_id: upJson.id }) }).eq('id', payment?.id)
        } else {
          // Fallback: enviar só copia/cola
          await sendText(phoneNumberId, waToken, from, `💠 *PIX Copia e Cola* — R$ ${total.toFixed(2)}\n\n${pixCode}`)
          await db.from('payments').update({ pix_code: pixCode }).eq('id', payment?.id)
          // metadata em pix_qr_url já preservado do insert
        }

        await sendText(phoneNumberId, waToken, from, '✅ Após o pagamento, seu pedido será confirmado automaticamente!\n\nDigite *0* para voltar ao menu.')

      } else if (hasMp) {
        // ── Mercado Pago fallback ──
        const mpToken = tenant?.mp_access_token || process.env.MERCADOPAGO_ACCESS_TOKEN
        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
          body: JSON.stringify({
            items: [{ title: `Pedido Catálogo - ${itemCount} item(s)`, quantity: 1, unit_price: total, currency_id: 'BRL' }],
            back_urls: { success: 'https://arkiel.com.br/pagamento/sucesso', failure: 'https://arkiel.com.br/pagamento/erro', pending: 'https://arkiel.com.br/pagamento/pendente' },
            auto_return: 'approved', external_reference: txid,
            notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
          }),
        })
        const mpData = await mpRes.json()
        if (mpData.init_point) {
          await sendText(phoneNumberId, waToken, from, `💳 *Pagamento do Pedido* — R$ ${total.toFixed(2)}\n\n*Pague via link seguro:*\n${mpData.init_point}\n\nAceita PIX, cartão e boleto.`)
          const oldMeta4 = JSON.parse(payment?.pix_qr_url || '{}')
          await db.from('payments').update({ pix_qr_url: JSON.stringify({ ...oldMeta4, mp_pref_id: mpData.id, mp_checkout_url: mpData.init_point, method: 'mercadopago' }) }).eq('id', payment?.id)
        }
      } else {
        // Sem pagamento configurado — orientar contato manual
        await sendText(phoneNumberId, waToken, from, `📞 Seu pedido de R$ ${total.toFixed(2)} foi recebido! Em breve entraremos em contato com as instruções de pagamento.`)
        if (orderId) await db.from('whatsapp_orders').update({ status: 'new' }).eq('id', orderId).then(() => {})
      }

      // Salvar mensagem no histórico
      await safeInsert(db, 'messages', {
        tenant_id: bot.tenant_id, bot_id: bot.id, contact_id: contact?.id || null,
        conversation_id: null, direction: 'outbound', type: 'text',
        content: `[Checkout automático — Pedido R$ ${total.toFixed(2)} — PIX enviado]`, sent_by: 'bot',
      })

      await savelog(db, 'catalog_checkout', null, { order_id: orderId, total, method: hasPix ? 'pix' : (hasMp ? 'mercadopago' : 'none') })
    } catch (e) {
      await savelog(db, 'catalog_checkout_error', String(e), { order_id: orderId, total })
    }
  }
}

async function sendText(phoneId, token, to, text) {
  const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  })
  const data = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(data))
  return data
}

async function processWebhook(body) {
  const db     = getDB()
  const change = body?.entry?.[0]?.changes?.[0]?.value
  await savelog(db, 'received', null, { object: body?.object })

  if (change?.statuses?.length) { await savelog(db, 'status_update', 'ignored'); return }
  const msgs = change?.messages
  if (!msgs?.length) { await savelog(db, 'no_messages', 'empty'); return }

  const msg           = msgs[0]
  const fromRaw       = msg.from || ''
  const from          = (fromRaw.startsWith('55') && fromRaw.length === 12)
                        ? fromRaw.slice(0,4) + '9' + fromRaw.slice(4)
                        : fromRaw
  const phoneNumberId = change?.metadata?.phone_number_id || PHONE_ID
  const wamId         = msg.id

  let userText = ''
  if (msg.type === 'text')        userText = msg.text?.body?.trim() || ''
  else if (msg.type === 'button') userText = msg.button?.text || msg.button?.payload || ''
  else if (msg.type === 'interactive') {
    const br = msg.interactive?.button_reply
    const lr = msg.interactive?.list_reply
    userText = br?.title || br?.id || lr?.title || lr?.id || ''
  }
  await savelog(db, 'parsed', null, { from, phoneNumberId, userText })

  // Pedido enviado via carrinho do catálogo (Multi/Single Product Message)
  if (msg.type === 'order') {
    await handleOrder(db, msg, from, phoneNumberId)
    return
  }

  // Bot
  const { data: botArr, error: botErr } = await db
    .from('bots')
    .select('id,name,status,phone_number_id,tenant_id,access_token,greeting,fallback_message,human_takeover_keyword,flow,tenants(id,plan,status,max_messages_month,subscription,plan_expires_at)')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'active')
    .limit(1)

  if (botErr || !botArr?.length) { await savelog(db, 'bot_not_found', botErr?.message || 'empty'); return }
  const bot = botArr[0]
  if (bot.tenants?.status !== 'active') { await savelog(db, 'tenant_inactive', bot.tenants?.status); return }
  await savelog(db, 'bot_found', null, { bot_id: bot.id })

  const tenantId = bot.tenant_id
  const tkn      = bot.access_token || WA_TOKEN

  // ── AUTO-VERIFICAÇÃO: o remetente é um bot do Arkiel? ──
  // Se o número de origem é um phone_number_id cadastrado como bot ativo,
  // não responde (evita loop de bot falando com bot)
  const { data: senderBots } = await db
    .from('bots')
    .select('id, name')
    .eq('status', 'active')
    .eq('phone_number_id', from)
    .limit(1)

  if (senderBots?.length) {
    await savelog(db, 'bot_vs_bot_blocked', null, { sender: from, bot: senderBots[0].name })
    return // Não responde — é outro bot
  }

  // Verificar também pelo phone_number cadastrado nos bots (campo separado)
  const { data: senderBotsByPhone } = await db
    .from('bots')
    .select('id, name')
    .eq('status', 'active')
    .eq('phone_number', from)
    .limit(1)

  if (senderBotsByPhone?.length) {
    await savelog(db, 'bot_vs_bot_blocked', null, { sender: from, bot: senderBotsByPhone[0].name })
    return
  }

  // Incrementar uso
  try {
    await db.rpc('increment_usage', { p_tenant_id: tenantId, p_month: new Date().toISOString().slice(0,7) })
  } catch(e) { await savelog(db, 'increment_err', e?.message) }

  // ── Verificar limites do plano (dinâmico ou hardcoded) ──
  try {
    const tenantData = bot.tenants || {}
    let sub = null
    try { sub = JSON.parse(tenantData.subscription || '{}') } catch {}

    let maxMessages = 500 // default free
    let planActive = false

    if (sub && sub.status === 'active') {
      if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
        // Expirou
        planActive = false
      } else {
        maxMessages = sub.limits?.max_messages_month || 500
        planActive = true
      }
    }

    if (!planActive && tenantData.status === 'active' && tenantData.plan !== 'free') {
      maxMessages = tenantData.max_messages_month || 500
      planActive = true
    }

    if (tenantData.plan === 'free' && !sub) planActive = true

    if (!planActive && tenantData.status !== 'active') {
      // Tenant suspenso
      await savelog(db, 'tenant_suspended', tenantData.status)
      try {
        await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${tkn}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: '⚠️ Este serviço está temporariamente indisponível. Entre em contato com o responsável.' } })
        })
      } catch {}
      return
    }

    // Verificar cota de mensagens
    const { data: usageData } = await db.rpc('get_usage', { p_tenant_id: tenantId, p_month: new Date().toISOString().slice(0,7) }).single()
    const currentMessages = usageData?.message_count || 0
    if (maxMessages < 999999 && currentMessages >= maxMessages) {
      await savelog(db, 'quota_exceeded', null, { current: currentMessages, max: maxMessages })
      try {
        await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${tkn}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: '⚠️ Limite de mensagens do plano atingido. Entre em contato para fazer upgrade.' } })
        })
      } catch {}
      return
    }
  } catch(e) { await savelog(db, 'limit_check_err', e?.message) }

  // Mark read
  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tkn}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamId })
    })
  } catch(_) {}

  // Contato
  let contact
  const { data: existingContact } = await db
    .from('contacts').select('id,phone').eq('tenant_id', tenantId).eq('phone', from).maybeSingle()

  if (existingContact) {
    contact = existingContact
  } else {
    const contactName = change?.contacts?.[0]?.profile?.name || ''
    const { data: newContact, error: contactErr } = await db
      .from('contacts').insert({ tenant_id: tenantId, phone: from, name: contactName || null }).select('id,phone').single()
    if (contactErr) { await savelog(db, 'contact_error', contactErr.message); return }
    contact = newContact
  }

  // Conversa
  let { data: conv } = await db
    .from('conversations').select('*')
    .eq('tenant_id', tenantId).eq('bot_id', bot.id).eq('contact_id', contact.id)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false }).limit(1).maybeSingle()

  if (!conv) {
    const { data: newConv, error: convErr } = await db
      .from('conversations').insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' }).select('*').single()
    if (convErr) { await savelog(db, 'conv_error', convErr.message); return }
    conv = newConv
  }
  await savelog(db, 'conv_ok', null, { node: conv.current_node_id, status: conv.status })

  // Extrair mídia (image, video, document, audio)
  let mediaId = null
  let mediaCaption = ''
  let mediaFilename = ''
  if (msg.type === 'image' && msg.image) {
    mediaId = msg.image.id || null
    mediaCaption = msg.image.caption || ''
  } else if (msg.type === 'video' && msg.video) {
    mediaId = msg.video.id || null
    mediaCaption = msg.video.caption || ''
  } else if (msg.type === 'document' && msg.document) {
    mediaId = msg.document.id || null
    mediaCaption = msg.document.caption || ''
    mediaFilename = msg.document.filename || ''
  } else if (msg.type === 'audio' && msg.audio) {
    mediaId = msg.audio.id || null
  } else if (msg.type === 'sticker' && msg.sticker) {
    mediaId = msg.sticker.id || null
  }

  // Texto exibido para mídia — codifica media_id no content para não depender de coluna extra
  let displayContent = userText
  if (mediaId) {
    const caption = mediaCaption || (msg.type === 'image' ? '🖼️ Imagem' : msg.type === 'video' ? '🎬 Vídeo' : msg.type === 'audio' ? '🎵 Áudio' : msg.type === 'document' ? '📎 ' + (mediaFilename || 'Documento') : '🎟️ Sticker')
    // Formato: __media__:{type}:{media_id}__ {caption}
    displayContent = `__media__:${msg.type}:${mediaId}__ ${caption}`
  } else if (!displayContent) {
    displayContent = `[${msg.type}]`
  }

  // Salvar inbound
  await safeInsert(db, 'messages', {
    tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
    contact_id: contact.id, direction: 'inbound', type: msg.type,
    content: displayContent, meta_message_id: wamId
  })

  // ── DETECÇÃO AUTOMÁTICA DE COMPROVANTE ──
  // Toda imagem ou PDF recebido = potencial comprovante de pagamento
  if (mediaId && (msg.type === 'image' || msg.type === 'document')) {
    try {
      // 1) Baixar a mídia do WhatsApp
      const metaResp = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${tkn}` }
      })
      const mediaData = await metaResp.json()

      if (mediaData?.url) {
        const fileResp = await fetch(mediaData.url, { headers: { Authorization: `Bearer ${tkn}` } })
        const buffer = Buffer.from(await fileResp.arrayBuffer())
        const mimeType = mediaData.mime_type || (msg.type === 'image' ? 'image/jpeg' : 'application/pdf')
        const ext = mimeType.includes('pdf') ? '.pdf' : mimeType.includes('png') ? '.png' : '.jpg'
        const fileName = `receipts/${tenantId}/${Date.now()}-${mediaId}${ext}`

        // Upload para Storage
        const { error: upErr } = await db.storage.from('payment-receipts').upload(fileName, buffer, { contentType: mimeType })
        let fileUrl = null
        if (!upErr) {
          const { data: urlData } = db.storage.from('payment-receipts').getPublicUrl(fileName)
          fileUrl = urlData.publicUrl
        }

        // 2) Verificar se há pagamento pendente nesta conversa
        const { data: pendingPayments } = await db.from('payments')
          .select('id, amount, pix_qr_url')
          .eq('bot_id', bot.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)

        const hasPending = pendingPayments?.length > 0

        if (hasPending) {
          // ── CASO A: pagamento pendente → vincula e confirma ──
          const payment = pendingPayments[0]
          await db.from('payment_receipts').insert({
            payment_id: payment.id, tenant_id: tenantId, conversation_id: conv.id, contact_id: contact.id,
            file_url: fileUrl || `__media__:${msg.type}:${mediaId}__`,
            file_type: msg.type === 'image' ? 'image' : 'pdf',
            file_name: mediaFilename || `comprovante-${Date.now()}`,
            uploaded_by: contact.phone || 'customer',
            notes: `Comprovante automático — R$ ${parseFloat(payment.amount).toFixed(2)}`,
            metadata: { media_id: mediaId, auto: true, payment_amount: payment.amount },
            category: 'b2c_client',
          })
          // Marcar como pago
          const { data: fullPayment } = await db.from('payments')
            .select('id, pix_qr_url')
            .eq('id', payment.id).maybeSingle()
          await db.from('payments').update({
            status: 'paid', paid_at: new Date().toISOString(),
            pix_qr_url: JSON.stringify({ receipt_auto: true, media_id: mediaId, manual_confirmation: false,
              ...JSON.parse(fullPayment?.pix_qr_url || '{}') })
          }).eq('id', payment.id)

          // Confirmar pedido do catálogo se aplicável (status column já existe)
          const catOrderId = JSON.parse(fullPayment?.pix_qr_url || '{}')?.order_id
          if (catOrderId) {
            await db.from('whatsapp_orders').update({
              status: 'paid'
            }).eq('id', catOrderId)
            await sendText(phoneNumberId, tkn, from, `🛒 *Pedido confirmado!*
Seu pagamento foi confirmado e seu pedido está sendo processado.

Obrigado pela compra! 🎉`)
          }
          // Avisar cliente
          await sendText(phoneNumberId, tkn, from, `✅ *Comprovante recebido!*

Pagamento de R$ ${parseFloat(payment.amount).toFixed(2)} confirmado.

Obrigado! 🎉`)
          await savelog(db, 'receipt_auto', null, { payment_id: payment.id, media_id: mediaId })
          // Push
          try {
            const pushPayload = {
              title: '📄 Comprovante recebido',
              body: `${contact.name || contact.phone} enviou comprovante de R$ ${parseFloat(payment.amount).toFixed(2)}`,
              url: '/painel?tab=receipts', tag: `ark-receipt-${payment.id}`,
            }
            await Promise.all([sendPushToTenant(tenantId, pushPayload), sendFcmToTenant(tenantId, pushPayload)])
          } catch (_) {}
          await db.from('conversations').update({ status: 'bot', current_node_id: null }).eq('id', conv.id)
          return res.status(200).json({ ok: true, receipt: true })

        } else {
          // ── CASO B: sem pagamento pendente → registra avulso ──
          // Tenta extrair valor do caption/legenda
          let captionVal = null
          if (mediaCaption) {
            const match = mediaCaption.match(/r\$\s*([0-9]+[.,]?[0-9]*)/i)
            if (match) captionVal = parseFloat(match[1].replace(',', '.'))
          }

          // Cria pagamento avulso (status: paid, sem cobrança prévia)
          const { data: avulsoPay } = await db.from('payments').insert({
            tenant_id: tenantId, bot_id: bot.id,
            amount: captionVal || 0,
            status: 'paid', pix_code: `AVULSO-${Date.now().toString(36).toUpperCase()}`,
            paid_at: new Date().toISOString(),
            pix_qr_url: JSON.stringify({ avulso: true, receipt_auto: true, contact_id: contact.id, conversation_id: conv.id, method: 'pix', description: mediaCaption || 'Pagamento avulso (comprovante)' }),
          }).select().single()

          await db.from('payment_receipts').insert({
            payment_id: avulsoPay?.id || null, tenant_id: tenantId, conversation_id: conv.id, contact_id: contact.id,
            file_url: fileUrl || `__media__:${msg.type}:${mediaId}__`,
            file_type: msg.type === 'image' ? 'image' : 'pdf',
            file_name: mediaFilename || `comprovante-${Date.now()}`,
            uploaded_by: contact.phone || 'customer',
            notes: captionVal ? `Comprovante avulso — R$ ${captionVal.toFixed(2)}` : 'Comprovante avulso (valor não identificado)',
            metadata: { media_id: mediaId, auto: true, avulso: true, caption: mediaCaption },
            category: 'b2c_client',
          })

          await sendText(phoneNumberId, tkn, from, `✅ *Comprovante recebido!*

${captionVal ? `Valor identificado: R$ ${captionVal.toFixed(2)}\n` : ''}Seu comprovante foi registrado com sucesso.

Obrigado! 🎉`)

          await savelog(db, 'receipt_auto_avulso', null, { media_id: mediaId, amount: captionVal })

          // Push
          try {
            const pushPayload = {
              title: '📄 Comprovante recebido (avulso)',
              body: `${contact.name || contact.phone} enviou um comprovante${captionVal ? ` de R$ ${captionVal.toFixed(2)}` : ''}`,
              url: '/painel?tab=receipts', tag: `ark-receipt-avulso-${Date.now()}`,
            }
            await Promise.all([sendPushToTenant(tenantId, pushPayload), sendFcmToTenant(tenantId, pushPayload)])
          } catch (_) {}

          await db.from('conversations').update({ status: 'bot', current_node_id: null }).eq('id', conv.id)
          return res.status(200).json({ ok: true, receipt: true, avulso: true })
        }
      }
    } catch (e) {
      await savelog(db, 'receipt_auto_err', e?.message)
      // Não interrompe o fluxo se falhar — continua normalmente
    }
  }

  // ── DETECÇÃO DE LOOP: mais de 10 mensagens trocadas em 30 segundos = bot ──
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
  const { count: recentCount } = await db
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conv.id)
    .gte('created_at', thirtySecondsAgo)

  if (recentCount && recentCount >= 10) {
    // Pausar o bot e notificar o humano
    await db.from('conversations').update({ status: 'no_bot' }).eq('id', conv.id)
    await savelog(db, 'loop_detected', null, { count: recentCount, conversation_id: conv.id })
    try {
      const loopReply = '⏸️ Detectei muitas mensagens em pouco tempo. Vou pausar as respostas automáticas para evitar loops. Um atendente humano vai responder em breve.'
      await sendText(phoneNumberId, tkn, from, loopReply)
      await safeInsert(db, 'messages', { tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', content: loopReply, sent_by: 'bot' })
      const pushPayload = {
        title: '⏸️ Loop detectado — bot pausado',
        body: `Possível bot conversando com ${contact.name || contact.phone}. Bot pausado automaticamente.`,
        url: '/admin/conversations',
        tag: `ark-loop-${conv.id}`,
      }
      await Promise.all([sendPushToTenant(tenantId, pushPayload), sendFcmToTenant(tenantId, pushPayload)])
    } catch (_) {}
    return
  }

  // Human mode ou Sem bot (checkbox do painel)
  if (conv.status === 'human' || conv.status === 'no_bot') {
    // Ainda salva a mensagem (já salvou acima), mas não responde com bot
    await db.from('conversations').update({ last_message: userText || '[mídia]', last_message_at: new Date().toISOString() }).eq('id', conv.id)
    await savelog(db, conv.status === 'human' ? 'human_mode' : 'no_bot_mode')
    return
  }

  // Human takeover keyword (atalho direto, sem depender do fluxo)
  if (bot.human_takeover_keyword && userText?.toLowerCase().includes(bot.human_takeover_keyword.toLowerCase())) {
    await db.from('conversations').update({ status: 'human' }).eq('id', conv.id)
    const reply = '👤 Transferindo para nossa equipe! Em breve um atendente entrará em contato. 😊'
    try { await sendText(phoneNumberId, tkn, from, reply) } catch(_) {}
    await safeInsert(db, 'messages', { tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', content: reply, sent_by: 'bot' })
    try {
      const pushPayload = {
        title: '👤 Cliente pediu atendimento humano',
        body: `${contact.name || contact.phone} está esperando no ${bot.name}`,
        url: '/admin/conversations',
        tag: `ark-human-${conv.id}`,
      }
      await Promise.all([sendPushToTenant(tenantId, pushPayload), sendFcmToTenant(tenantId, pushPayload)])
    } catch (_) {}
    await savelog(db, 'done_human')
    return
  }

  // ── Motor de fluxo unificado (lib/flowEngine.js) ──
  const nodes = bot.flow?.nodes || []
  // Se está aguardando valor de pagamento
  if (conv.status === 'awaiting_payment_amount') {
    const payAmount = parseFloat(userText.replace(',', '.').replace(/[^\d.]/g, ''))
    if (!isNaN(payAmount) && payAmount > 0) {
      // Criar pagamento com o valor informado
      const { generatePixCode } = await import('../../../lib/pix')
      const QRCodeModule = await import('qrcode')
      const { data: tenant } = await db.from('tenants').select('pix_key, merchant_name, merchant_city, name').eq('id', tenantId).maybeSingle()

      const txid = `ARK${Date.now().toString(36).toUpperCase()}`
      const { data: payment } = await db.from('payments').insert({
        tenant_id: tenantId, bot_id: bot.id,
        amount: payAmount, status: 'pending', pix_code: txid,
        pix_qr_url: JSON.stringify({ txid, from_flow: true, contact_id: contact.id, conversation_id: conv.id, method: 'pix', description: 'Pagamento via bot' }),
      }).select().single()

      if (tenant?.pix_key) {
        const pixCode = generatePixCode({
          pixKey: tenant.pix_key,
          merchantName: (tenant.merchant_name || tenant.name || 'Arkiel').substring(0, 25),
          merchantCity: (tenant.merchant_city || 'SAO PAULO').substring(0, 15),
          amount: payAmount, txid,
        })
        const qrBuffer = await QRCodeModule.default.toBuffer(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
        const blob = new Blob([qrBuffer], { type: 'image/png' })
        const formData = new FormData()
        formData.append('messaging_product', 'whatsapp')
        formData.append('type', 'image/png')
        formData.append('file', blob, 'pix_qr.png')
        const upRes = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${tkn}` }, body: formData })
        const upJson = await upRes.json()
        if (upJson.id) {
          await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tkn}` },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'image',
              image: { id: upJson.id, caption: `💰 *Pagamento PIX* - R$ ${payAmount.toFixed(2)}\n\n*Escaneie ou copie:*\n\n${pixCode}` } }),
          })
          const flowMeta = JSON.parse(payment.pix_qr_url || '{}')
          await db.from('payments').update({ pix_code: pixCode, pix_qr_url: JSON.stringify({ ...flowMeta, qr_media_id: upJson.id }) }).eq('id', payment.id)
        }
        await sendText(phoneNumberId, tkn, from, '✅ PIX enviado! Após o pagamento, você receberá a confirmação. Digite *0* para voltar ao menu.')
        await db.from('conversations').update({ status: 'bot', current_node_id: null }).eq('id', conv.id)
        await safeInsert(db, 'messages', { tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id, contact_id: contact.id, direction: 'outbound', content: `[PIX R$ ${payAmount.toFixed(2)} enviado]`, sent_by: 'bot' })
        return res.status(200).json({ ok: true })
      }
    } else {
      await sendText(phoneNumberId, tkn, from, '❌ Valor inválido. Digite um número (ex: 29.90) ou *0* para voltar ao menu.')
      return res.status(200).json({ ok: true })
    }
  }

  const result = processFlow(nodes, conv.current_node_id, userText, { greeting: bot.greeting })
  await savelog(db, 'flow_result', null, { action: result.action, nodeId: result.nodeId, reply: result.reply?.substring(0,60) })

  let reply = result.reply || bot.fallback_message || 'Não entendi. Digite *0* para voltar ao menu.'
  let nodeId = result.nodeId
  let convUpdate = { last_message: reply, last_message_at: new Date().toISOString(), current_node_id: nodeId }

  if (result.action === 'transfer') {
    convUpdate.status = 'human'
  } else if (result.action === 'end') {
    convUpdate.status = 'closed'
  }

  // Enviar
  try {
    if (result.action === 'catalog') {
      let q = db.from('products').select('*').eq('tenant_id', tenantId).eq('is_active', true)
      if (result.category) q = q.eq('category', result.category)
      const { data: catalogProducts } = await q.order('created_at', { ascending: false }).limit(30)

      if (catalogProducts?.length) {
        await sendProductList({
          phoneNumberId, token: tkn, to: from,
          headerText: bot.name || 'Catálogo',
          bodyText: reply || 'Dá uma olhada nos nossos produtos 👇',
          products: catalogProducts, tenantId,
        })
        reply = `[catálogo enviado — ${catalogProducts.length} produto(s)]`
      } else {
        await sendText(phoneNumberId, tkn, from, reply || 'No momento não temos produtos disponíveis no catálogo. Digite *0* para voltar ao menu.')
      }
    } else if (result.action === 'payment') {
      // Enviar mensagem do nó de pagamento primeiro
      if (reply) await sendText(phoneNumberId, tkn, from, reply)

      // Determinar valor
      let payAmount = result.amount ? parseFloat(result.amount) : null
      if (!payAmount) {
        // Se não tem valor fixo, o cliente precisa informar — guarda estado especial
        await db.from('conversations').update({ current_node_id: nodeId, status: 'awaiting_payment_amount' }).eq('id', conv.id)
        await sendText(phoneNumberId, tkn, from, '💰 Qual valor você deseja pagar? (ex: 29.90)')
        reply = '[aguardando valor do pagamento]'
      } else {
        // Criar pagamento e enviar
        const { generatePixCode } = await import('../../../lib/pix')
        const QRCodeModule = await import('qrcode')

        // Buscar config do tenant
        const { data: tenant } = await db.from('tenants').select('pix_key, merchant_name, merchant_city, mp_access_token, name').eq('id', tenantId).maybeSingle()
        const payMethod = result.payMethod || 'pix'

        const txid = `ARK${Date.now().toString(36).toUpperCase()}`
        const { data: payment } = await db.from('payments').insert({
          tenant_id: tenantId, bot_id: bot.id, conversation_id: conv.id, contact_id: contact.id,
          amount: payAmount, description: reply?.substring(0, 100) || 'Pagamento via bot',
          status: 'pending', method: payMethod, payment_ref: txid, metadata: { txid, from_flow: true },
        }).select().single()

        if (payMethod === 'pix' && tenant?.pix_key) {
          const pixCode = generatePixCode({
            pixKey: tenant.pix_key,
            merchantName: (tenant.merchant_name || tenant.name || 'Arkiel').substring(0, 25),
            merchantCity: (tenant.merchant_city || 'SAO PAULO').substring(0, 15),
            amount: payAmount, txid,
          })
          const qrBuffer = await QRCodeModule.default.toBuffer(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
          const blob = new Blob([qrBuffer], { type: 'image/png' })
          const formData = new FormData()
          formData.append('messaging_product', 'whatsapp')
          formData.append('type', 'image/png')
          formData.append('file', blob, 'pix_qr.png')
          const upRes = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${tkn}` }, body: formData })
          const upJson = await upRes.json()

          if (upJson.id) {
            await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tkn}` },
              body: JSON.stringify({
                messaging_product: 'whatsapp', to: from, type: 'image',
                image: { id: upJson.id, caption: `💰 *Pagamento PIX* - R$ ${payAmount.toFixed(2)}\n\n*Escaneie o QR Code ou copie: *\n\n${pixCode}` },
              }),
            })
            const flowMeta = JSON.parse(payment.pix_qr_url || '{}')
          await db.from('payments').update({ pix_code: pixCode, pix_qr_url: JSON.stringify({ ...flowMeta, qr_media_id: upJson.id }) }).eq('id', payment.id)
            reply = `[PIX enviado - R$ ${payAmount.toFixed(2)}]`
          } else {
            await sendText(phoneNumberId, tkn, from, `💠 *PIX Copia e Cola* - R$ ${payAmount.toFixed(2)}\n\n${pixCode}`)
            await db.from('payments').update({ pix_code: pixCode }).eq('id', payment.id)
          // metadata em pix_qr_url já preservado
            reply = `[PIX enviado - R$ ${payAmount.toFixed(2)}]`
          }
        } else if (payMethod === 'mercadopago' && process.env.MERCADOPAGO_ACCESS_TOKEN) {
          const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
            body: JSON.stringify({
              items: [{ title: reply?.substring(0, 50) || 'Pagamento', quantity: 1, unit_price: payAmount, currency_id: 'BRL' }],
              back_urls: { success: 'https://arkiel.com.br/pagamento/sucesso', failure: 'https://arkiel.com.br/pagamento/erro', pending: 'https://arkiel.com.br/pagamento/pendente' },
              auto_return: 'approved', external_reference: txid,
              notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
            }),
          })
          const mpData = await mpRes.json()
          if (mpData.init_point) {
            await sendText(phoneNumberId, tkn, from, `💳 *Pagamento* - R$ ${payAmount.toFixed(2)}\n\n*Pague via link seguro:*\n${mpData.init_point}\n\nAceita PIX, cartão e boleto.`)
            await db.from('payments').update({ mp_preference_id: mpData.id, mp_checkout_url: mpData.init_point }).eq('id', payment.id)
            reply = `[Link MP enviado - R$ ${payAmount.toFixed(2)}]`
          } else {
            await sendText(phoneNumberId, tkn, from, '❌ Erro ao gerar pagamento. Tente novamente ou digite *0* para voltar ao menu.')
            reply = '[erro ao gerar pagamento MP]'
          }
        } else {
          await sendText(phoneNumberId, tkn, from, '⚠️ Pagamento não configurado. Contate o suporte. Digite *0* para voltar ao menu.')
          reply = '[pagamento não configurado]'
        }
      }
    } else {
      await sendText(phoneNumberId, tkn, from, reply)
    }
    await savelog(db, 'send_ok', null, { to: from })
  } catch(e) {
    await savelog(db, 'send_err', e?.message)
    // Fallback: se o envio do catálogo falhar (ex: catálogo não configurado ainda), manda texto
    if (result.action === 'catalog') {
      try { await sendText(phoneNumberId, tkn, from, bot.fallback_message || 'Não consegui carregar o catálogo agora. Digite *0* para voltar ao menu.') } catch(_) {}
    }
  }

  await safeInsert(db, 'messages', {
    tenant_id: tenantId, conversation_id: conv.id, bot_id: bot.id,
    contact_id: contact.id, direction: 'outbound', content: reply, sent_by: 'bot'
  })
  await db.from('conversations').update(convUpdate).eq('id', conv.id)

  if (result.action === 'transfer') {
    try {
      const pushPayload = {
        title: '👤 Cliente pediu atendimento humano',
        body: `${contact.name || contact.phone} está esperando no ${bot.name}`,
        url: '/admin/conversations',
        tag: `ark-human-${conv.id}`,
      }
      await Promise.all([sendPushToTenant(tenantId, pushPayload), sendFcmToTenant(tenantId, pushPayload)])
    } catch (_) {}
  }

  await savelog(db, 'done', null, { nodeId, action: result.action })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token === VERIFY_TK) return res.status(200).send(challenge)
    return res.status(403).end()
  }
  if (req.method !== 'POST') return res.status(405).end()

  try {
    await processWebhook(req.body)
  } catch(err) {
    try {
      const db = getDB()
      await db.from('webhook_logs').insert({ step: 'fatal', error: String(err?.message) + ' | ' + String(err?.stack).substring(0,300) })
    } catch(_) {}
  }

  return res.status(200).json({ ok: true })
}
