/**
 * POST /api/payments/webhook/mercadopago
 * Recebe notificações do Mercado Pago, atualiza status, confirma pedidos do catálogo,
 * cria comprovante automático, registra taxa da plataforma (marketplace fee / split).
 */
import { supabaseAdmin } from '../../../../lib/supabase'
import { activatePlan } from '../../../../lib/planActivation'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  const db = supabaseAdmin()

  try {
    const { type, data } = req.body || {}

    if (type === 'payment' && data?.id) {
      const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
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

        // Buscar pagamento existente pra preservar metadata em pix_qr_url
        const { data: existPay } = await db.from('payments').select('id, pix_qr_url').eq('pix_code', txid).maybeSingle()
        const existMeta = JSON.parse(existPay?.pix_qr_url || '{}')
        const updateData = { status, paid_at: status === 'paid' ? new Date().toISOString() : null, pix_qr_url: JSON.stringify({ ...existMeta, mp_payment_id: data.id, mp_status: payData.status, mp_payment_method: payData.payment_method_id }) }
        if (status === 'paid') updateData.paid_at = new Date().toISOString()

        await db.from('payments').update(updateData).eq('pix_code', txid)

        // ── Confirmar pagamento ──
        if (status === 'paid') {
          const { data: payment } = await db.from('payments')
            .select('id, tenant_id, bot_id, amount, pix_qr_url')
            .eq('pix_code', txid).maybeSingle()

          if (payment) {
            // ── COMPRA DE CRÉDITOS: creditar e sair (não é transação de tenant) ──
            const payMeta = JSON.parse(payment.pix_qr_url || '{}')
            if (payMeta.type === 'credit_purchase') {
              try {
                // Registrar a compra como paga
                await db.from('credit_purchases').insert({
                  tenant_id: payment.tenant_id,
                  credit_type: payMeta.credit_type,
                  quantity: payMeta.quantity,
                  unit_price_brl: payMeta.unit_price,
                  total_price_brl: payMeta.total_price,
                  arkiel_margin_brl: payMeta.arkiel_margin,
                  meta_cost_brl: payMeta.meta_cost,
                  payment_id: payment.id,
                  status: 'paid',
                })

                // Creditar o saldo (ler-modificar-escrever em conversation_credits)
                const { data: cc } = await db.from('conversation_credits')
                  .select('id, balance, total_purchased')
                  .eq('tenant_id', payment.tenant_id)
                  .eq('credit_type', payMeta.credit_type)
                  .maybeSingle()

                if (cc) {
                  await db.from('conversation_credits').update({
                    balance: (cc.balance || 0) + payMeta.quantity,
                    total_purchased: (cc.total_purchased || 0) + payMeta.quantity,
                    updated_at: new Date().toISOString(),
                  }).eq('id', cc.id)
                } else {
                  await db.from('conversation_credits').insert({
                    tenant_id: payment.tenant_id,
                    credit_type: payMeta.credit_type,
                    balance: payMeta.quantity,
                    total_purchased: payMeta.quantity,
                    total_used: 0,
                  })
                }

                console.log('[webhook-mp] Créditos creditados:', payMeta.quantity, payMeta.credit_type, 'tenant:', payment.tenant_id)

                // Comprovante automático da compra de créditos (aba Comprovantes)
                try {
                  await db.from('payment_receipts').insert({
                    payment_id: payment.id,
                    tenant_id: payment.tenant_id,
                    file_url: null,
                    file_type: 'mp_confirmation',
                    file_name: `MP-${data.id} · ${payMeta.quantity} créditos`,
                    uploaded_by: 'mercadopago',
                    notes: `Compra de créditos confirmada via Mercado Pago — R$ ${parseFloat(payment.amount).toFixed(2)} (${payData.payment_method_id || 'pix'}) · ${payMeta.quantity}x ${payMeta.credit_type === 'marketing' ? 'marketing' : 'mensagens iniciais'}`,
                    category: 'credit_purchase',
                  })
                } catch (e) {
                  console.error('[webhook-mp] Erro ao registrar comprovante de créditos:', e.message)
                }

                // Push pro admin
                try {
                  const { sendPushToTenant } = await import('../../../../lib/webpush')
                  await sendPushToTenant(payment.tenant_id, {
                    title: '✅ Créditos adicionados!',
                    body: `${payMeta.quantity} créditos de ${payMeta.credit_type === 'marketing' ? 'marketing' : 'mensagens iniciais'} foram adicionados ao seu saldo.`,
                    url: '/admin/marketing',
                    tag: `ark-credits-${payment.id}`,
                  })
                } catch (_) {}
              } catch (e) {
                console.error('[webhook-mp] Erro ao creditar compra de créditos:', e.message)
              }
              return res.status(200).json({ ok: true, credited: true })
            }

            // Comprovante automático
            await db.from('payment_receipts').insert({
              payment_id: payment.id,
              tenant_id: payment.tenant_id,
              
              file_url: null,
              file_type: 'mp_confirmation',
              file_name: `MP-${data.id}`,
              uploaded_by: 'mercadopago',
              notes: `Pagamento confirmado via Mercado Pago — R$ ${parseFloat(payment.amount).toFixed(2)} (${payData.payment_method_id})`,
              
              category: 'b2c_client',
            })

            // ── Registrar taxa da plataforma (marketplace fee / split) ──
            try {
              const grossAmount = parseFloat(payment.amount) || parseFloat(payData.transaction_amount) || 0
              const mpFee = parseFloat(payData.marketplace_fee) || 0
              const isSplit = !!payData.marketplace || mpFee > 0

              // Buscar config de taxa do tenant
              const { data: tenant } = await db.from('tenants')
                .select('mp_access_token')
                .eq('id', payment.tenant_id)
                .maybeSingle()

              let feePercent = 2.0
              let splitEnabled = false
              let splitCollected = false
              try {
                const tenantConfig = JSON.parse(tenant?.mp_access_token || '{}')
                const mc = tenantConfig.marketplace_config || {}
                if (mc.fee_percent) feePercent = parseFloat(mc.fee_percent)
                if (mc.split_enabled !== undefined) splitEnabled = !!mc.split_enabled
              } catch (_) {}

              const calculatedFee = +(grossAmount * feePercent / 100).toFixed(2)

              // Se o MP retornou marketplace_fee, o split ja foi coletado automaticamente
              if (isSplit && mpFee > 0) {
                splitCollected = true
              }

              await db.from('platform_fees').insert({
                tenant_id: payment.tenant_id,
                payment_id: String(data.id),
                gross_amount: grossAmount,
                fee_percent: feePercent,
                fee_amount: mpFee > 0 ? mpFee : calculatedFee,
                payment_method: payData.payment_method_id || 'unknown',
                status: 'pending',
                split_collected: splitCollected,
                split_payment_id: isSplit ? String(data.id) : null,
              })

              console.log(`[webhook-mp] Taxa registrada: R$ ${mpFee > 0 ? mpFee : calculatedFee} (${feePercent}% de R$ ${grossAmount}) | Split: ${splitCollected ? 'automatico' : 'manual'}`)
            } catch (e) {
              console.error('[webhook-mp] Erro ao registrar taxa:', e.message)
            }

            // ── Atualizar pedido do catalogo se aplicavel ──
            const orderId = JSON.parse(payment.pix_qr_url || '{}')?.order_id
            if (orderId) {
              await db.from('whatsapp_orders').update({
                status: 'paid',
              }).eq('id', orderId)
            }

            // ── Notificar cliente via WhatsApp ──
            const { data: bot } = await db.from('bots').select('phone_number_id, access_token').eq('id', payment.bot_id || '').maybeSingle()
            const meta = JSON.parse(payment.pix_qr_url || '{}')
            const { data: contact } = await db.from('contacts').select('phone').eq('id', meta.contact_id || '').maybeSingle()

            if (bot?.phone_number_id && contact?.phone) {
              const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
              const isCatalog = !!meta.from_catalog
              const confirmText = isCatalog
                ? `✅ *Pagamento confirmado!*\n\nValor: R$ ${parseFloat(payment.amount).toFixed(2)}\nSeu pedido do catalogo foi confirmado e esta sendo processado. 🎉\n\nObrigado pela compra!`
                : `✅ *Pagamento confirmado!*\n\nValor: R$ ${parseFloat(payment.amount).toFixed(2)}\n${meta.description || ''}\n\nObrigado pelo pagamento! 🎉`

              try {
                await fetch(`https://graph.facebook.com/v25.0/${bot.phone_number_id}/messages`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
                  body: JSON.stringify({ messaging_product: 'whatsapp', to: contact.phone, type: 'text', text: { body: confirmText } }),
                })
                await db.from('messages').insert({
                  tenant_id: payment.tenant_id, bot_id: payment.bot_id,
                  contact_id: meta.contact_id || null, direction: 'outbound', type: 'text', content: confirmText, sent_by: 'bot'
                })
              } catch (_) {}
            }

            // ── Ativar plano se for assinatura ──
            try {
              const result = await activatePlan(db, payment)
              if (result.ok) {
                console.log('[webhook-mp] Plano ativado:', JSON.parse(payment.pix_qr_url || '{}')?.plan_name)
              }
            } catch (e) { console.error('[webhook-mp] Erro ao ativar plano:', e.message) }

            // ── Push notification pro admin ──
            try {
              const { sendPushToTenant } = await import('../../../../lib/webpush')
              const { sendFcmToTenant } = await import('../../../../lib/fcm')
              const pushPayload = {
                title: '✅ Pagamento confirmado!',
                body: `R$ ${parseFloat(payment.amount).toFixed(2)}${isCatalog ? ' — Pedido do catalogo' : ''}`,
                url: '/painel?tab=receipts',
                tag: `ark-paid-${payment.id}`,
              }
              await Promise.all([
                sendPushToTenant(payment.tenant_id, pushPayload),
                sendFcmToTenant(payment.tenant_id, pushPayload),
              ])
            } catch (_) {}
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
