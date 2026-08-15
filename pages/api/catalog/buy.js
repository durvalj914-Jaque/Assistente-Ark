/**
 * POST /api/catalog/buy
 * Cria um pedido a partir da vitrine pública e gera pagamento (PIX ou link MP).
 * Body: { tenantId, productId, customerName, customerPhone, method }
 * Pública — não exige auth (o cliente final não tem login).
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { generatePixCode } from '../../../lib/pix'
import { retailerIdFor } from '../../../lib/metaCatalog'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenantId, productId, customerName, customerPhone, method = 'whatsapp' } = req.body || {}
  if (!tenantId || !productId) return res.status(400).json({ error: 'tenantId e productId são obrigatórios' })

  const db = supabaseAdmin()

  // Buscar produto
  const { data: product, error: prodErr } = await db.from('products')
    .select('*').eq('id', productId).eq('tenant_id', tenantId).eq('is_active', true).maybeSingle()
  if (prodErr || !product) return res.status(404).json({ error: 'Produto não encontrado ou indisponível' })

  // Buscar tenant
  const { data: tenant } = await db.from('tenants')
    .select('id, name, pix_key, merchant_name, merchant_city').eq('id', tenantId).maybeSingle()
  if (!tenant) return res.status(404).json({ error: 'Loja não encontrada' })

  // Buscar bot para WhatsApp
  const { data: bot } = await db.from('bots')
    .select('id, phone_number_id').eq('tenant_id', tenantId).limit(1).maybeSingle()

  // Buscar ou criar contato
  let contactId = null
  if (customerPhone) {
    const cleanPhone = customerPhone.replace(/\D/g, '')
    const { data: existing } = await db.from('contacts')
      .select('id').eq('phone', cleanPhone).eq('tenant_id', tenantId).maybeSingle()
    if (existing) {
      contactId = existing.id
    } else {
      const { data: newContact } = await db.from('contacts')
        .insert({ tenant_id: tenantId, phone: cleanPhone, name: customerName || 'Cliente' })
        .select().single()
      contactId = newContact?.id
    }
  }

  // Criar pedido (usando schema existente: items[], total, catalog_id)
  const orderRef = `CAT${Date.now().toString(36).toUpperCase()}`
  const retailerId = product.meta_retailer_id || retailerIdFor(tenantId, product.id)
  const catalogId = process.env.ARKIEL_META_CATALOG_ID || null

  const { data: order, error: orderErr } = await db.from('whatsapp_orders').insert({
    tenant_id: tenantId,
    bot_id: bot?.id || null,
    contact_id: contactId,
    catalog_id: catalogId,
    items: [{
      currency: 'BRL',
      quantity: 1,
      item_price: parseFloat(product.price),
      product_retailer_id: retailerId,
      product_name: product.name,
    }],
    total: parseFloat(product.price),
    currency: 'BRL',
    status: 'pending',
    note: `Pedido via vitrine web — ${orderRef}${customerName ? ` — Cliente: ${customerName}` : ''}${customerPhone ? ` — Tel: ${customerPhone}` : ''}`,
  }).select().single()

  if (orderErr) return res.status(500).json({ error: 'Erro ao criar pedido', detail: orderErr.message })

  const amount = parseFloat(product.price)
  const pixKey = tenant.pix_key
  const merchantName = (tenant.merchant_name || tenant.name || 'Arkiel').substring(0, 25)
  const merchantCity = (tenant.merchant_city || 'SAO PAULO').substring(0, 15)

  // ── Pagamento via PIX ──
  if (method === 'pix' && pixKey) {
    const txid = orderRef.substring(0, 25)
    const pixCode = generatePixCode({
      pixKey,
      merchantName,
      merchantCity,
      amount,
      txid,
      description: product.name.substring(0, 40),
    })

    // Gravar pagamento
    await db.from('payments').insert({
      tenant_id: tenantId,
      bot_id: bot?.id || null,
      contact_id: contactId,
      amount,
      description: `Catálogo: ${product.name}`,
      status: 'pending',
      method: 'pix',
      pix_code: pixCode,
      metadata: { order_id: order.id, order_ref: orderRef, from_catalog: true, product_id: productId },
    })

    return res.status(200).json({
      ok: true,
      method: 'pix',
      pixCode,
      orderRef,
      orderId: order.id,
      productName: product.name,
      amount,
    })
  }

  // ── Pagamento via Mercado Pago ──
  if (method === 'mercadopago') {
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!mpToken) return res.status(400).json({ error: 'Mercado Pago não configurado' })

    // Calcular taxa da plataforma (2%)
    const _buyFee = Number((amount * 2.0 / 100).toFixed(2))

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify({
        items: [{ title: product.name, quantity: 1, unit_price: amount, currency_id: 'BRL', picture_url: product.image_url || undefined }],
        marketplace: 'ARKIEL',
        marketplace_fee: _buyFee,
        back_urls: {
          success: 'https://arkiel.com.br/catalog/success',
          failure: 'https://arkiel.com.br/catalog/error',
          pending: 'https://arkiel.com.br/catalog/pending',
        },
        auto_return: 'approved',
        external_reference: orderRef,
        notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
      }),
    })
    const mpData = await mpRes.json()
    if (!mpData.init_point) return res.status(500).json({ error: 'Falha ao criar pagamento' })

    // Gravar pagamento
    await db.from('payments').insert({
      tenant_id: tenantId,
      bot_id: bot?.id || null,
      contact_id: contactId,
      amount,
      description: `Catálogo: ${product.name}`,
      status: 'pending',
      method: 'mercadopago',
      mp_preference_id: mpData.id,
      mp_checkout_url: mpData.init_point,
      metadata: { order_id: order.id, order_ref: orderRef, from_catalog: true, product_id: productId },
    })

    return res.status(200).json({
      ok: true,
      method: 'mercadopago',
      checkoutUrl: mpData.init_point,
      orderRef,
      orderId: order.id,
    })
  }

  // ── Fallback: redirect to WhatsApp ──
  let waNumber = null
  if (bot?.phone_number_id) {
    const token = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${bot.phone_number_id}?fields=display_phone_number&access_token=${token}`)
      const d = await r.json()
      waNumber = d.display_phone_number?.replace(/\D/g, '') || null
    } catch (_) {}
  }

  const waMsg = encodeURIComponent(`Olá! Tenho interesse no produto: ${product.name} (R$ ${amount.toFixed(2)})`)
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${waMsg}` : null

  return res.status(200).json({
    ok: true,
    method: 'whatsapp',
    whatsappLink: waLink,
    orderRef,
    orderId: order.id,
    productName: product.name,
    amount,
  })
}
