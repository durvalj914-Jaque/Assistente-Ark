/**
 * POST /api/billing/webhook-google
 * Recebe notificações RTDN (Real-Time Developer Notifications) do Google Play
 * via Google Cloud Pub/Sub → Webhook
 *
 * Configure no Google Play Console:
 * Configuração do app → Monetização → Notificações de desenvolvedor em tempo real
 * → URL do endpoint: https://arkiel.com.br/api/billing/webhook-google
 */
import { supabaseAdmin }            from '../../../lib/supabase'
import { verifyGoogleSubscription, isSubscriptionActive } from '../../../lib/googleBilling'
import { PLANS, GOOGLE_PLAY_PACKAGE, getPlanByProductId } from '../../../lib/plans'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.status(200).end() // Responde 200 imediatamente (Pub/Sub exige)

  try {
    const { message } = req.body
    if (!message?.data) return

    const decoded   = JSON.parse(Buffer.from(message.data, 'base64').toString())
    const notifType = decoded.subscriptionNotification || decoded.oneTimeProductNotification
    if (!notifType) return

    const { purchaseToken, subscriptionId, productId, notificationType } = notifType
    const db = supabaseAdmin()

    // Busca o tenant pelo purchase_token
    const { data: tenant } = await db
      .from('tenants')
      .select('id,plan,status')
      .eq('google_purchase_token', purchaseToken)
      .maybeSingle()

    if (!tenant) {
      console.log('[billing-rtdn] Token não encontrado:', purchaseToken)
      return
    }

    const SUBSCRIPTION_TYPES = {
      1:  'RECOVERED',
      2:  'RENEWED',
      3:  'CANCELED',
      4:  'PURCHASED',
      5:  'ON_HOLD',
      6:  'IN_GRACE_PERIOD',
      7:  'RESTARTED',
      12: 'REVOKED',
      13: 'EXPIRED'
    }

    const eventName = SUBSCRIPTION_TYPES[notificationType] || `UNKNOWN_${notificationType}`
    console.log('[billing-rtdn]', eventName, 'tenant:', tenant.id)

    let newStatus = tenant.status
    let newPlan   = tenant.plan
    let expiresAt = null

    if ([1, 2, 4, 6, 7].includes(notificationType)) {
      // Assinatura ativa/renovada/recuperada
      try {
        const pid      = subscriptionId || productId
        const subData  = await verifyGoogleSubscription(GOOGLE_PLAY_PACKAGE, pid, purchaseToken)
        const active   = isSubscriptionActive(subData)
        expiresAt      = new Date(parseInt(subData.expiryTimeMillis || '0')).toISOString()
        newStatus      = active ? 'active' : 'suspended'
        newPlan        = active ? getPlanByProductId(pid) : 'free'
      } catch (e) {
        console.error('[billing-rtdn] Verify error:', e.message)
      }
    } else if ([3, 5, 12, 13].includes(notificationType)) {
      // Cancelada, suspensa, revogada ou expirada
      newStatus = notificationType === 5 ? 'suspended' : 'active'
      newPlan   = notificationType === 5 ? tenant.plan : 'free'
    }

    await db.from('tenants').update({
      plan:    newPlan,
      status:  newStatus,
      ...(expiresAt && { plan_expires_at: expiresAt }),
      updated_at: new Date().toISOString()
    }).eq('id', tenant.id)

    await db.from('billing_events').insert({
      tenant_id:      tenant.id,
      provider:       'google_play',
      event_type:     `rtdn_${eventName.toLowerCase()}`,
      purchase_token: purchaseToken,
      product_id:     subscriptionId || productId,
      status:         newStatus === 'active' ? 'verified' : 'failed',
      raw_payload:    decoded
    })
  } catch (err) {
    console.error('[billing-rtdn] Erro:', err)
  }
}
