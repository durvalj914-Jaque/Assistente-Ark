/**
 * POST /api/billing/verify-google
 * Recebe a compra do app mobile, verifica na Google Play API
 * e atualiza o plano do tenant no Supabase.
 *
 * Body: { purchaseToken, productId, orderId, tenantId }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin }            from '../../../lib/supabase'
import { verifyGoogleSubscription, verifyGoogleProduct, isSubscriptionActive } from '../../../lib/googleBilling'
import { PLANS, GOOGLE_PLAY_PACKAGE, getPlanByProductId } from '../../../lib/plans'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { purchaseToken, productId, orderId, tenantId } = req.body
  if (!purchaseToken || !productId || !tenantId) {
    return res.status(400).json({ error: 'purchaseToken, productId e tenantId são obrigatórios' })
  }

  // Autentica o usuário via Bearer token
  const authHeader = req.headers.authorization || ''
  const userToken  = authHeader.replace('Bearer ', '')
  const db         = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  // Confirma que o usuário pertence ao tenant
  const { data: member } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()
  if (!member) return res.status(403).json({ error: 'Acesso negado ao tenant' })

  let verifyData, isActive, expiresAt
  const isSubscription = productId.includes('monthly') || productId.includes('annual') || productId.includes('yearly')

  try {
    if (isSubscription) {
      verifyData = await verifyGoogleSubscription(GOOGLE_PLAY_PACKAGE, productId, purchaseToken)
      isActive   = isSubscriptionActive(verifyData)
      expiresAt  = new Date(parseInt(verifyData.expiryTimeMillis || '0')).toISOString()
    } else {
      verifyData = await verifyGoogleProduct(GOOGLE_PLAY_PACKAGE, productId, purchaseToken)
      isActive   = verifyData.purchaseState === 0 // 0=comprado
      expiresAt  = null
    }
  } catch (err) {
    console.error('[billing] Erro Google Play API:', err.message)
    return res.status(502).json({ error: 'Falha ao verificar compra no Google Play', detail: err.message })
  }

  // Salva evento de billing para auditoria
  await db.from('billing_events').insert({
    tenant_id:      tenantId,
    provider:       'google_play',
    event_type:     isSubscription ? 'subscription_purchase' : 'iap_purchase',
    order_id:       orderId,
    product_id:     productId,
    purchase_token: purchaseToken,
    status:         isActive ? 'verified' : 'failed',
    raw_payload:    verifyData
  })

  if (!isActive) {
    return res.status(402).json({ error: 'Compra não confirmada pelo Google Play', verifyData })
  }

  // Mapeia productId → plano
  const newPlan = getPlanByProductId(productId)
  const planCfg = PLANS[newPlan]

  // Atualiza o tenant
  await db.from('tenants').update({
    plan:                  newPlan,
    status:                'active',
    google_product_id:     productId,
    google_purchase_token: purchaseToken,
    google_order_id:       orderId,
    billing_provider:      'google_play',
    plan_expires_at:       expiresAt,
    max_bots:              planCfg.max_bots,
    max_messages_month:    planCfg.max_messages_month,
    updated_at:            new Date().toISOString()
  }).eq('id', tenantId)

  return res.status(200).json({
    success: true,
    plan:    newPlan,
    expires: expiresAt,
    limits:  { max_bots: planCfg.max_bots, max_messages_month: planCfg.max_messages_month }
  })
}
