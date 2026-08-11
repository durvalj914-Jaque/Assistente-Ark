import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // MP sometimes sends GET for validation
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true })
  }

  const db = supabaseAdmin()

  try {
    const body = req.body || {}
    const type = body.type || body.action
    const paymentId = body.data?.id

    console.log('[mp-webhook] Received:', { type, paymentId, body: JSON.stringify(body).substring(0, 500) })

    if (!paymentId) return res.status(200).json({ ok: true })

    // Only process payment notifications
    if (!type?.includes('payment') && type !== 'payment.updated' && type !== 'payment.created' && type !== 'payment') {
      return res.status(200).json({ ok: true })
    }

    // Try platform token first
    let payment = null
    const platformToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
    
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${platformToken}` }
    })
    
    if (mpRes.ok) {
      payment = await mpRes.json()
    }

    // If platform token fails, try to find the order by payment_id in notes
    // and use the tenant's token
    if (!payment) {
      console.log('[mp-webhook] Platform token failed, searching orders for payment_id:', paymentId)
      const { data: orders } = await db.from('whatsapp_orders')
        .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status, note')
        .ilike('note', `%${paymentId}%`)
        .limit(5)

      if (orders && orders.length > 0) {
        for (const ord of orders) {
          const { data: tenant } = await db.from('tenants')
            .select('mp_access_token')
            .eq('id', ord.tenant_id)
            .maybeSingle()

          if (tenant?.mp_access_token) {
            try {
              const tokenData = JSON.parse(tenant.mp_access_token)
              const tenantRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
              })
              if (tenantRes.ok) {
                payment = await tenantRes.json()
                console.log('[mp-webhook] Found payment via tenant token for order:', ord.id)
                break
              }
            } catch (e) { /* try next */ }
          }
        }
      }
    }

    if (!payment) {
      console.log('[mp-webhook] Could not fetch payment:', paymentId)
      return res.status(200).json({ ok: true })
    }

    console.log('[mp-webhook] Payment:', payment.id, 'status:', payment.status)

    // Find order by metadata or by payment_id in notes
    const orderId = payment.metadata?.order_id
    let order = null

    if (orderId) {
      const { data } = await db.from('whatsapp_orders')
        .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status, note')
        .eq('id', orderId)
        .maybeSingle()
      order = data
    }

    if (!order) {
      // Try to find by payment_id stored in note
      const { data: orders } = await db.from('whatsapp_orders')
        .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status, note')
        .ilike('note', `%${paymentId}%`)
        .limit(1)
      order = orders?.[0]
    }

    if (!order) {
      console.log('[mp-webhook] Order not found for payment:', paymentId)
      return res.status(200).json({ ok: true })
    }

    if (payment.status === 'approved') {
      const existingNote = order.note ? (typeof order.note === 'string' ? JSON.parse(order.note) : order.note) : {}
      const updatedNote = { 
        ...existingNote, 
        payment_id: String(payment.id), 
        payment_method: payment.payment_method_id || 'pix', 
        paid_at: new Date().toISOString() 
      }

      await db.from('whatsapp_orders').update({
        status: 'paid',
        note: JSON.stringify(updatedNote)
      }).eq('id', order.id)

      // Send confirmation to customer
      const { data: bot } = await db.from('bots')
        .select('phone_number_id, access_token')
        .eq('id', order.bot_id)
        .maybeSingle()
      const { data: contact } = await db.from('contacts')
        .select('phone')
        .eq('id', order.contact_id)
        .maybeSingle()

      if (bot && contact) {
        const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
        const phoneId = bot.phone_number_id
        const totalFmt = Number(order.total).toFixed(2).replace('.', ',')

        const confirmText = `✅ *Pagamento confirmado!*

📋 Pedido: ${order.id.substring(0, 8)}
💰 Valor: R$ ${totalFmt}
💳 Método: ${payment.payment_method_id === 'pix' ? 'PIX' : payment.payment_method_id || 'Cartão'}

Seu pedido está sendo processado. Obrigado! 🎉`

        await sendText(phoneId, waToken, contact.phone, confirmText)

        await db.from('messages').insert({
          tenant_id: order.tenant_id,
          conversation_id: order.conversation_id,
          bot_id: order.bot_id,
          contact_id: order.contact_id,
          direction: 'outbound',
          type: 'text',
          content: confirmText
        })
      }

      console.log('[mp-webhook] ✅ Payment approved for order:', order.id)
    } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
      await db.from('whatsapp_orders').update({ status: 'payment_failed' }).eq('id', order.id)
      console.log('[mp-webhook] ❌ Payment failed for order:', order.id)
    } else {
      console.log('[mp-webhook] Payment pending/in_progress for order:', order.id, 'status:', payment.status)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[mp-webhook] Error:', err.message?.substring(0, 200))
    return res.status(200).json({ ok: true })
  }
}
