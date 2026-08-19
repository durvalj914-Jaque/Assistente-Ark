import { supabaseAdmin } from '../../../lib/supabase'
import { sendText } from '../../../lib/meta'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const db = supabaseAdmin()

  try {
    const body = req.body || {}
    
    let type = body.type || body.action || body.topic
    let paymentId = body.data?.id || body.resource
    
    if (body.action && body.action.includes('payment')) {
      type = 'payment'
      paymentId = body.data?.id
    }

    console.log('[mp-webhook] Received:', { type, paymentId, body: JSON.stringify(body).substring(0, 500) })

    if (!paymentId) return res.status(200).json({ ok: true })

    if (!type?.includes('payment') && type !== 'payment') {
      return res.status(200).json({ ok: true })
    }

    let payment = null
    const platformToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
    
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${platformToken}` }
    })
    
    if (mpRes.ok) {
      payment = await mpRes.json()
    }

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

    const orderId = payment.metadata?.order_id
    let order = null

    if (orderId) {
      const { data } = await db.from('whatsapp_orders')
        .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status, note')
        .eq('id', orderId)
        .maybeSingle()
      order = data
    }

    if (!order && payment.external_reference) {
      const { data } = await db.from('whatsapp_orders')
        .select('id, tenant_id, bot_id, contact_id, conversation_id, total, status, note')
        .eq('id', payment.external_reference)
        .maybeSingle()
      order = data
    }

    if (!order) {
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

      // ── OPTION B: Record platform fee in platform_fees table ──
      try {
        const grossAmount = parseFloat(order.total) || 0
        const paymentMethod = payment.payment_method_id || 'pix'
        
        // Tudo processado via Mercado Pago — taxa unificada
        let feeMethod = 'mercado_pago'
        // Fallback: se nao houver config para 'mercado_pago', tenta metodo especifico (legacy)
        const legacyMethodMap = {
          pix: 'pix', credit_card: 'credit_card', debit_card: 'debit_card',
          boleto: 'boleto', bank_transfer: 'bank_transfer',
          account_balance: 'account_balance', paypal: 'paypal', prepaid_card: 'prepaid_card'
        }

        const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
        const { data: arkielTenant } = await db.from('tenants')
          .select('mp_access_token')
          .eq('id', ARKIEL_TENANT_ID)
          .maybeSingle()
        
        let feePercent = 2.0
        let feeFixed = 0
        let feeMin = 0
        let feeMax = 0
        let feeType = 'percent'
        if (arkielTenant?.mp_access_token) {
          try {
            const mp = JSON.parse(arkielTenant.mp_access_token)
            // Prioriza config unificada 'mercado_pago'; fallback para metodo especifico (legacy)
            let cfgKey = mp.fee_config?.mercado_pago ? 'mercado_pago' : null
            if (!cfgKey) {
              // Tenta mapear payment_method do MP para chave legacy
              const pm = payment.payment_method_id || ''
              let legacyKey = 'pix'
              if (pm.includes('credit')) legacyKey = 'credit_card'
              else if (pm.includes('debit')) legacyKey = 'debit_card'
              else if (pm === 'ticket' || pm.includes('boleto')) legacyKey = 'boleto'
              else if (pm.includes('bank_transfer') || pm.includes('transfer')) legacyKey = 'bank_transfer'
              else if (pm.includes('account_balance') || pm === 'money') legacyKey = 'account_balance'
              else if (pm.includes('paypal')) legacyKey = 'paypal'
              else if (pm.includes('prepaid')) legacyKey = 'prepaid_card'
              if (mp.fee_config?.[legacyKey]) cfgKey = legacyKey
            }
            if (cfgKey && mp.fee_config[cfgKey]) {
              const cfg = mp.fee_config[cfgKey]
              // Suporta formato antigo (número) e novo (objeto)
              if (typeof cfg === 'number') {
                feePercent = cfg
              } else if (typeof cfg === 'object') {
                feePercent = cfg.fee_percent || 0
                feeFixed = cfg.fee_fixed || 0
                feeMin = cfg.fee_min || 0
                feeMax = cfg.fee_max || 0
                feeType = cfg.fee_type || 'percent'
              }
            }
          } catch {}
        }
        
        // Calcula taxa baseado no modelo escolhido (fee_type)
        let feeAmount = 0
        if (feeType === 'percent') {
          feeAmount = Number((grossAmount * (feePercent / 100)).toFixed(2))
        } else if (feeType === 'fixed') {
          feeAmount = feeFixed
        } else if (feeType === 'percent_fixed') {
          feeAmount = Number((grossAmount * (feePercent / 100) + feeFixed).toFixed(2))
        } else if (feeType === 'percent_min') {
          feeAmount = Number((grossAmount * (feePercent / 100)).toFixed(2))
          if (feeMin > 0 && feeAmount < feeMin) feeAmount = feeMin
        } else if (feeType === 'percent_max') {
          feeAmount = Number((grossAmount * (feePercent / 100)).toFixed(2))
          if (feeMax > 0 && feeAmount > feeMax) feeAmount = feeMax
        } else if (feeType === 'percent_min_max') {
          feeAmount = Number((grossAmount * (feePercent / 100)).toFixed(2))
          if (feeMin > 0 && feeAmount < feeMin) feeAmount = feeMin
          if (feeMax > 0 && feeAmount > feeMax) feeAmount = feeMax
        } else if (feeType === 'fixed_range') {
          feeAmount = feeFixed || feeMin
          if (feeMin > 0 && feeAmount < feeMin) feeAmount = feeMin
          if (feeMax > 0 && feeAmount > feeMax) feeAmount = feeMax
        } else {
          // Fallback: percentual + fixo com min/max (legado)
          feeAmount = Number((grossAmount * (feePercent / 100) + feeFixed).toFixed(2))
          if (feeMin > 0 && feeAmount < feeMin) feeAmount = feeMin
          if (feeMax > 0 && feeAmount > feeMax) feeAmount = feeMax
        }

        const { data: existingFee } = await db.from('platform_fees')
          .select('id')
          .eq('payment_id', String(payment.id))
          .maybeSingle()

        if (!existingFee && feeAmount > 0) {
          await db.from('platform_fees').insert({
            tenant_id: order.tenant_id,
            order_id: order.id,
            payment_id: String(payment.id),
            gross_amount: grossAmount,
            fee_percent: feePercent,
            fee_amount: feeAmount,
            payment_method: paymentMethod,
            status: 'pending'
          })
          console.log('[mp-webhook] 💰 Platform fee recorded:', feeAmount, 'for tenant:', order.tenant_id)
        }
      } catch (feeErr) {
        console.error('[mp-webhook] Error recording platform fee:', feeErr.message)
      }

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
