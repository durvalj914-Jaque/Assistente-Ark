import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const db = supabaseAdmin()
  const tenantId = req.query.tenant_id

  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' })

  try {
    // Get tenant's MP token
    const { data: tenant } = await db.from('tenants')
      .select('mp_access_token')
      .eq('id', tenantId)
      .maybeSingle()

    let token = null
    let usingPlatform = false
    
    if (tenant?.mp_access_token) {
      try {
        const parsed = JSON.parse(tenant.mp_access_token)
        token = parsed.access_token
      } catch {
        token = tenant.mp_access_token
      }
    }

    // Fallback para token da plataforma se tenant não tem proprio token
    if (!token) {
      token = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
      usingPlatform = true
    }

    if (!token) return res.status(200).json({ connected: false, methods: [] })

    // Fetch payment methods from MP API
    const mpRes = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!mpRes.ok) {
      return res.status(200).json({ connected: true, methods: [], error: 'Failed to fetch methods' })
    }

    const allMethods = await mpRes.json()

    // Filter and group by relevant categories
    const relevantTypes = ['bank_transfer', 'credit_card', 'debit_card', 'ticket', 'account_money']
    const filtered = allMethods.filter(m => relevantTypes.includes(m.payment_type_id))

    // Group into categories
    const categories = {
      pix: { label: 'PIX', icon: '💸', desc: 'Copia e cola + QR Code', methods: [] },
      credit_card: { label: 'Cartão de Crédito', icon: '💳', desc: 'Parcelamento via Checkout MP', methods: [] },
      debit_card: { label: 'Cartão de Débito', icon: '💳', desc: 'Débito online via Checkout MP', methods: [] },
      boleto: { label: 'Boleto Bancário', icon: '🧾', desc: 'Compensação em 1-2 dias úteis', methods: [] },
      account_money: { label: 'Saldo Mercado Pago', icon: '💰', desc: 'Saldo em conta MP', methods: [] }
    }

    for (const m of filtered) {
      if (m.payment_type_id === 'bank_transfer' && m.id === 'pix') {
        categories.pix.methods.push({ id: m.id, name: m.name })
      } else if (m.payment_type_id === 'credit_card') {
        categories.credit_card.methods.push({ id: m.id, name: m.name })
      } else if (m.payment_type_id === 'debit_card') {
        categories.debit_card.methods.push({ id: m.id, name: m.name })
      } else if (m.payment_type_id === 'ticket') {
        categories.boleto.methods.push({ id: m.id, name: m.name })
      } else if (m.payment_type_id === 'account_money') {
        categories.account_money.methods.push({ id: m.id, name: m.name })
      }
    }

    // Return only categories that have methods
    const result = Object.entries(categories)
      .filter(([_, cat]) => cat.methods.length > 0)
      .map(([key, cat]) => ({ key, ...cat }))

    return res.status(200).json({ connected: true, methods: result, using_platform_token: usingPlatform })
  } catch (e) {
    console.error('[mp-methods] Error:', e.message)
    return res.status(200).json({ connected: false, methods: [], error: e.message })
  }
}
