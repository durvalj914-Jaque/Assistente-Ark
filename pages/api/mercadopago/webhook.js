import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const db = supabaseAdmin()

  try {
    const body = req.body || {}
    const type = body.type || body.action
    const paymentId = body.data?.id

    console.log('[mercado-pago] Webhook received:', { type, paymentId })

    if (!paymentId) return res.status(200).json({ ok: true })

    if (!type?.includes('payment') && type !== 'payment' && type !== 'payment.updated' && type !== 'payment.created') {
      return res.status(200).json({ ok: true })
    }

    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN_2
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const payment = await mpRes.json()

    console.log('[mercado-pago] Payment status:', payment.status, 'ID:', payment.id)

    const orderId = payment.metadata?.order_id
    const tenantId = payment.metadata?.tenant_id

    if (!orderId) {
      console.log('[mercado-pago] No order_id in metadata, skipping')
      return res.status(200).json({ ok: true })
    }

    const { data: order } = await db.from('whatsapp_orders')
      .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) {
      console.log('[mercado-pago] Order not found:', orderId)
      return res.status(200).json({ ok: true })
    }

    if (payment.status === 'approved') {
      await db.from('whatsapp_orders').update({
        status: 'paid',
        payment_id: String(payment.id),
        payment_method: 'pix',
        paid_at: new Date().toISOString()
      }).eq('id', order.id)

      const { data: bot } = await db.from('bots').select('phone_number_id, access_token').eq('id', order.bot_id).maybeSingle()
      const { data: contact } = await db.from('contacts').select('phone').eq('id', order.contact_id).maybeSingle()

      if (bot && contact) {
        const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
        const phoneId = bot.phone_number_id
        const totalFmt = Number(order.total).toFixed(2).replace('.', ',')

        const confirmText = `✅ *Pagamento confirmado!*\n\n📋 Pedido: ${order.id.substring(0, 8)}\n💰 Valor: R$ ${totalFmt}\n💳 Método: PIX\n\nSeu pedido está sendo processado. Obrigado pela compra! 🎉`

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

      console.log('[mercado-pago] Payment approved for order:', orderId)
    } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
      await db.from('whatsapp_orders').update({
        status: 'payment_failed',
        payment_id: String(payment.id)
      }).eq('id', order.id)

      console.log('[mercado-pago] Payment failed for order:', orderId, payment.status)
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[mercado-pago] Webhook error:', err.message)
    return res.status(200).json({ ok: true })
  }
}
