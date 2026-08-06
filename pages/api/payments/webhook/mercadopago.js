/**
 * POST /api/payments/webhook/mercadopago
 * Recebe notificações do Mercado Pago, atualiza status e cria comprovante automático.
 */
import { supabaseAdmin } from '../../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  const db = supabaseAdmin()

  try {
    const { type, data } = req.body || {}

    if (type === 'payment' && data?.id) {
      const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
      if (!mpToken) return res.status(200).json({ ok: true })

      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      })
      const payData = await payRes.json()

      if (payData.external_reference) {
        const txid = payData.external_reference

        let status = 'pending'
        if (payData.status === 'approved') status = 'paid'
        else if (payData.status === 'cancelled' || payData.status === 'rejected') status = 'cancelled'
        else if (payData.status === 'expired') status = 'expired'

        const updateData = { status, metadata: { mp_payment_id: data.id, mp_status: payData.status, mp_payment_method: payData.payment_method_id } }
        if (status === 'paid') updateData.paid_at = new Date().toISOString()

        await db.from('payments').update(updateData).eq('payment_ref', txid)

        // ── CRIAR COMPROVANTE AUTOMÁTICO quando pago via Mercado Pago ──
        if (status === 'paid') {
          const { data: payment } = await db.from('payments')
            .select('id, tenant_id, conversation_id, contact_id, amount, description, method')
            .eq('payment_ref', txid).maybeSingle()

          if (payment) {
            await db.from('payment_receipts').insert({
              payment_id: payment.id,
              tenant_id: payment.tenant_id,
              conversation_id: payment.conversation_id,
              contact_id: payment.contact_id,
              file_url: null,
              file_type: 'mp_confirmation',
              file_name: `MP-${data.id}`,
              uploaded_by: 'mercadopago',
              notes: `Pagamento confirmado via Mercado Pago — R$ ${parseFloat(payment.amount).toFixed(2)} (${payData.payment_method_id})`,
              metadata: { mp_payment_id: data.id, mp_status: payData.status, auto: true, payment_method: payData.payment_method_id },
              category: 'b2c_client',
            })

            // Notificar cliente via WhatsApp
            if (payment.conversation_id) {
              const { data: bot } = await db.from('bots').select('phone_number_id, access_token').eq('id', payment.bot_id || '').maybeSingle()
              const { data: contact } = await db.from('contacts').select('phone').eq('id', payment.contact_id).maybeSingle()

              if (bot?.phone_number_id && contact?.phone) {
                const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
                const confirmText = `✅ *Pagamento confirmado!*\n\nValor: R$ ${parseFloat(payment.amount).toFixed(2)}\n${payment.description || ''}\n\nObrigado pelo pagamento! 🎉`

                try {
                  await fetch(`https://graph.facebook.com/v25.0/${bot.phone_number_id}/messages`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
                    body: JSON.stringify({ messaging_product: 'whatsapp', to: contact.phone, type: 'text', text: { body: confirmText } }),
                  })
                  await db.from('messages').insert({
                    tenant_id: payment.tenant_id, conversation_id: payment.conversation_id, bot_id: payment.bot_id,
                    contact_id: payment.contact_id, direction: 'outbound', type: 'text', content: confirmText, sent_by: 'bot'
                  })
                } catch (_) {}
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('MP webhook error:', e.message)
    return res.status(200).json({ ok: true })
  }
}
