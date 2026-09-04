import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

// Preços por tipo de crédito
const CREDIT_PRICES = {
  utility:  { unit: 0.05, meta_cost: 0.0374, arkiel_margin: 0.01, label: 'Mensagens Iniciais' },
  marketing: { unit: 0.36, meta_cost: 0.3438, arkiel_margin: 0.02, label: 'Mensagens de Marketing' },
}

// Token MP da Arkiel (plataforma) — quem recebe o dinheiro da compra de créditos
function getArkielMpToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2 || process.env.MERCADOPAGO_ACCESS_TOKEN
}

export default async function handler(req, res) {
  const db = getDB()

  if (req.method === 'POST') {
    const { tenant_id, credit_type, quantity } = req.body

    if (!tenant_id || !credit_type || !quantity) {
      return res.status(400).json({ error: 'tenant_id, credit_type e quantity são obrigatórios' })
    }
    if (!CREDIT_PRICES[credit_type]) {
      return res.status(400).json({ error: 'credit_type inválido (use: utility ou marketing)' })
    }

    const qty = parseInt(quantity)
    if (qty < 1 || qty > 100000) {
      return res.status(400).json({ error: 'Quantidade deve ser entre 1 e 100.000' })
    }

    const price = CREDIT_PRICES[credit_type]
    const total = Number((price.unit * qty).toFixed(2))

    // Verificar se o tenant existe
    const { data: tenant } = await db.from('tenants')
      .select('id, name')
      .eq('id', tenant_id).maybeSingle()

    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' })

    const txid = `ARK${Date.now().toString(36).toUpperCase()}`

    // ── 1) Tentar gerar PIX via Mercado Pago (QR sempre válido) ──
    const mpToken = getArkielMpToken()
    let pixCode = null
    let pixQr = null
    let mpPaymentId = null
    let usedProvider = 'static'

    let mpError = null
    if (mpToken) {
      try {
        const pixRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `credits-${txid}`
          },
          body: JSON.stringify({
            transaction_amount: total,
            description: `Créditos ${price.label} — ${tenant.name} (x${qty})`,
            payment_method_id: 'pix',
            external_reference: txid,
            metadata: {
              type: 'credit_purchase',
              tenant_id,
              credit_type,
              quantity: qty,
            },
            notification_url: 'https://arkiel.com.br/api/payments/webhook/mercadopago',
          })
        })
        const pixData = await pixRes.json()
        const tdata = pixData?.point_of_interaction?.transaction_data
        if (pixRes.ok && tdata?.qr_code) {
          pixCode = tdata.qr_code
          pixQr = 'data:image/png;base64,' + tdata.qr_code_base64
          mpPaymentId = String(pixData.id)
          usedProvider = 'mercadopago'
        } else {
          mpError = JSON.stringify(pixData).substring(0, 400)
          console.error('[credits/purchase] MP falhou, usando BR Code estático:', mpError)
        }
      } catch (e) {
        console.error('[credits/purchase] Erro MP:', e.message)
      }
    }

    // ── 2) Fallback: BR Code estático (chave PIX da Arkiel) ──
    if (!pixCode && !mpToken) mpError = 'sem token MP configurado'
    if (!pixCode) {
      try {
        const { generatePixCode } = await import('../../../lib/pix')
        const { default: QRCodeModule } = await import('qrcode')
        pixCode = generatePixCode({
          pixKey: process.env.ARKIEL_PIX_KEY || 'arkieltech@gmail.com',
          merchantName: process.env.ARKIEL_MERCHANT_NAME || 'ARKIEL TECNOLOGIA',
          merchantCity: process.env.ARKIEL_MERCHANT_CITY || 'SAO PAULO',
          amount: total,
          txid,
        })
        pixQr = await QRCodeModule.toDataURL(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      } catch (e) {
        console.error('[credits/purchase] Erro BR Code estático:', e.message)
        return res.status(500).json({ error: 'Erro ao gerar PIX: ' + e.message })
      }
    }

    // ── 3) Registrar pagamento pendente ──
    const meta = JSON.stringify({
      type: 'credit_purchase',
      credit_type,
      quantity: qty,
      unit_price: price.unit,
      total_price: total,
      arkiel_margin: price.arkiel_margin,
      meta_cost: price.meta_cost,
      provider: usedProvider,
      mp_error: mpError,
    })

    let paymentId = null
    try {
      const { data: payment } = await db.from('payments').insert({
        tenant_id,
        amount: total,
        status: 'pending',
        pix_code: txid,
        pix_qr_url: meta,
      }).select().single()
      paymentId = payment?.id
    } catch (e) {
      console.error('[credits/purchase] Erro ao registrar payment:', e.message)
    }

    return res.status(200).json({
      ok: true,
      payment_id: paymentId,
      pix_code: pixCode,
      pix_qr: pixQr,
      provider: usedProvider,
      mp_payment_id: mpPaymentId,
      amount: total,
      credit_type,
      credit_label: price.label,
      quantity: qty,
      unit_price: price.unit,
      meta_cost_per_unit: price.meta_cost,
      arkiel_margin_per_unit: price.arkiel_margin,
      breakdown: {
        meta_cost: (price.meta_cost * qty).toFixed(2),
        arkiel_margin: (price.arkiel_margin * qty).toFixed(2),
        total: total.toFixed(2),
      },
    })
  }

  // GET: listar histórico de compras
  if (req.method === 'GET') {
    const { tenant_id } = req.query
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' })

    const { data: purchases, error } = await db.from('credit_purchases')
      .select('id, credit_type, quantity, unit_price_brl, total_price_brl, arkiel_margin_brl, meta_cost_brl, status, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ purchases: purchases || [] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
