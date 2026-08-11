import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const db = supabaseAdmin()

  try {
    const body = req.body || {}
    const type = body.type || body.action
    const paymentId = body.data?.id

    console.log('[mp-webhook] Received:', { type, paymentId })

    if (!paymentId) return res.status(200).json({ ok: true })

    if (!type?.includes('payment') && type !== 'payment.updated' && type !== 'payment.created') {
      return res.status(200).json({ ok: true })
    }

    // Fetch payment from Mercado Pago
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN_2
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const payment = await mpRes.json()

    console.log('[mp-webhook] Payment:', payment.id, 'status:', payment.status)

    const orderId = payment.metadata?.order_id
    if (!orderId) return res.status(200).json({ ok: true })

    // Find order
    const { data: order } = await db.from('whatsapp_orders')
      .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status, note')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) {
      console.log('[mp-webhook] Order not found:', orderId)
      return res.status(200).json({ ok: true })
    }

    if (payment.status === 'approved') {
      // Merge payment info into note JSON
      const existingNote = order.note ? (typeof order.note === 'string' ? JSON.parse(order.note) : order.note) : {}
      const updatedNote = { ...existingNote, payment_id: String(payment.id), payment_method: payment.payment_method_id || 'pix', paid_at: new Date().toISOString() }

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

      console.log('[mp-webhook] ✅ Payment approved for order:', orderId)
    } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
      await db.from('whatsapp_orders').update({ status: 'payment_failed' }).eq('id', order.id)
      console.log('[mp-webhook] ❌ Payment failed for order:', orderId)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[mp-webhook] Error:', err.message?.substring(0, 200))
    return res.status(200).json({ ok: true })
  }
}
