/**
 * POST /api/plans/subscribe
 * Cliente B2B seleciona um plano e gera cobrança (PIX ou MP).
 * O plan_id é embutido no external_reference para ativação automática no webhook.
 *
 * Body: { plan_id, method: 'pix' | 'mercadopago' }
 * Response: { payment_id, pix_code, qr_url, checkout_url }
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'
import { generatePixCode } from '../../../lib/pix'
import QRCode from 'qrcode'

const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const { plan_id, method = 'pix' } = req.body
  if (!plan_id) return res.status(400).json({ error: 'Plano é obrigatório' })

  const db = supabaseAdmin()

  // Resolver tenant do cliente (mesma lógica do useTenant)
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!member) return res.status(403).json({ error: 'Tenant não encontrado' })

  const clientTenantId = member.tenant_id

  // Buscar o plano (do catalogo Arkiel)
  const { data: arkielTenant } = await db.from('tenants')
    .select('mp_access_token')
    .eq('id', ARKIEL_TENANT_ID)
    .maybeSingle()

  let plans = []
  try {
    const parsed = JSON.parse(arkielTenant?.mp_access_token || '{}')
    plans = parsed.plans || []
  } catch {}

  // Tentar tabela plans também
  if (plans.length === 0) {
    const { data: dbPlans } = await db.from('plans').select('*').eq('id', plan_id).maybeSingle()
    if (dbPlans) plans = [dbPlans]
  }

  const plan = plans.find(p => p.id === plan_id)
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado' })
  if (plan.active === false) return res.status(400).json({ error: 'Plano inativo' })

  // Buscar recursos do plano
  let resources = []
  try {
    const parsed = JSON.parse(arkielTenant?.mp_access_token || '{}')
    resources = parsed.plan_resources || []
  } catch {}

  const planResources = (plan.resource_ids || []).map(rid => resources.find(r => r.id === rid)).filter(Boolean)

  // Calcular vigência
  const now = new Date()
  let expiresAt = null
  switch (plan.billing_cycle) {
    case 'monthly': expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); break
    case 'quarterly': expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); break
    case 'yearly': expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); break
    case 'lifetime': expiresAt = null; break
    case 'custom': expiresAt = plan.duration_days ? new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000) : null; break
    default: expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  }

  const amount = parseFloat(plan.price) || 0
  if (amount <= 0) return res.status(400).json({ error: 'Valor do plano inválido' })

  // Gerar TXID com referência ao plano
  const txid = `ARKPLAN${plan.id.substring(0, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`

  // Metadata do pagamento — usado pelo webhook para ativar o plano
  const paymentMeta = {
    type: 'plan_subscription',
    plan_id: plan.id,
    plan_name: plan.name,
    tenant_id: clientTenantId,
    billing_cycle: plan.billing_cycle,
    expires_at: expiresAt?.toISOString() || null,
    resource_ids: plan.resource_ids || [],
    resource_names: planResources.map(r => r.name),
  }

  // Buscar config de pagamento do tenant Arkiel (para PIX)
  const { data: arkielTenantFull } = await db.from('tenants')
    .select('pix_key, merchant_name, merchant_city, mp_access_token')
    .eq('id', ARKIEL_TENANT_ID)
    .maybeSingle()

  const pixKey = arkielTenantFull?.pix_key
  const merchantName = (arkielTenantFull?.merchant_name || 'Arkiel').substring(0, 25)
  const merchantCity = (arkielTenantFull?.merchant_city || 'SAO PAULO').substring(0, 15)

  let mpToken = null
  if (arkielTenantFull?.mp_access_token) {
    try { mpToken = JSON.parse(arkielTenantFull.mp_access_token).access_token } catch { mpToken = arkielTenantFull.mp_access_token }
  }
  if (!mpToken) mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2

  const description = `Plano ${plan.name} — Arkiel`

  // Criar registro de pagamento
  const { data: payment, error: payError } = await db.from('payments').insert({
    tenant_id: clientTenantId,
    amount,
    status: 'pending',
    pix_code: txid,
    pix_qr_url: JSON.stringify({ ...paymentMeta, description, method, category: 'plan_subscription' }),
  }).select().single()

  if (payError) {
    console.error('[subscribe] Erro ao criar pagamento:', payError)
    return res.status(500).json({ error: 'Erro ao criar pagamento: ' + payError.message })
  }

  let pixCode = null
  let qrUrl = null
  let checkoutUrl = null

  if (method === 'pix') {
    // Tentar PIX dinâmico via MP primeiro
    if (mpToken) {
      try {
        const mpPixRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}`, 'X-Idempotency-Key': txid },
          body: JSON.stringify({
            transaction_amount: amount,
            description,
            payment_method_id: 'pix',
            external_reference: txid,
            notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
            payer: { email: user.email || 'cliente@arkiel.com.br' }
          })
        })
        const mpPixData = await mpPixRes.json()
        if (mpPixData?.point_of_interaction?.transaction_data?.qr_code) {
          pixCode = mpPixData.point_of_interaction.transaction_data.qr_code
          const qrBase64 = mpPixData.point_of_interaction.transaction_data.qr_code_base64
          if (qrBase64) {
            qrUrl = `data:image/png;base64,${qrBase64}`
          }
        }
      } catch (e) { console.error('[subscribe] MP PIX falhou:', e.message) }
    }

    // Fallback para PIX estático
    if (!pixCode && pixKey) {
      pixCode = generatePixCode({
        pixKey, merchantName, merchantCity,
        amount, txid, description: description.substring(0, 50)
      })
      try {
        const qrBuffer = await QRCode.toBuffer(pixCode, { width: 300, margin: 2 })
        qrUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`
      } catch {}
    }

  } else if (method === 'mercadopago') {
    if (!mpToken) return res.status(400).json({ error: 'Mercado Pago não configurado' })

    // Calcular taxa da plataforma — ler config dinâmica
    const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
    let _subFeePct = 2.0
    try {
      const { data: _at } = await db.from('tenants').select('mp_access_token').eq('id', ARKIEL_TENANT_ID).maybeSingle()
      const _parsed = JSON.parse(_at?.mp_access_token || '{}')
      _subFeePct = _parsed.fee_config?.pix ?? 2.0
    } catch {}
    const _subFee = Number((amount * _subFeePct / 100).toFixed(2))

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}`, 'X-Idempotency-Key': txid },
      body: JSON.stringify({
        items: [{ title: description, quantity: 1, unit_price: amount, currency_id: 'BRL' }],
        marketplace: 'ARKIEL',
        marketplace_fee: _subFee,
        back_urls: {
          success: 'https://arkiel.com.br/client?tab=finance&payment=success',
          failure: 'https://arkiel.com.br/client?tab=finance&payment=error',
          pending: 'https://arkiel.com.br/client?tab=finance&payment=pending'
        },
        auto_return: 'approved',
        external_reference: txid,
        statement_descriptor: 'Arkiel',
        notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
      }),
    })
    const mpData = await mpRes.json()
    if (mpData.init_point) checkoutUrl = mpData.init_point
  }

  return res.status(200).json({
    ok: true,
    payment_id: payment.id,
    plan_name: plan.name,
    amount,
    method,
    pix_code: pixCode,
    qr_url: qrUrl,
    checkout_url: checkoutUrl,
    expires_at: expiresAt?.toISOString(),
  })
}
