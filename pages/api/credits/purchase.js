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

// Chave PIX da Arkiel — sempre usada para receber pagamentos de créditos
// (o cliente compra DA Arkiel, não de si mesmo)
const ARKIEL_PIX_KEY = process.env.ARKIEL_PIX_KEY || 'arkieltech@gmail.com'
const ARKIEL_MERCHANT_NAME = process.env.ARKIEL_MERCHANT_NAME || 'ARKIEL TECNOLOGIA'
const ARKIEL_MERCHANT_CITY = process.env.ARKIEL_MERCHANT_CITY || 'SAO PAULO'

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
    const total = (price.unit * qty).toFixed(2)
    
    // Verificar se o tenant existe
    const { data: tenant } = await db.from('tenants')
      .select('id, name')
      .eq('id', tenant_id).maybeSingle()
    
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' })
    
    // Gerar PIX usando a chave da Arkiel (sempre)
    try {
      const { generatePixCode } = await import('../../../lib/pix')
      const QRCodeModule = await import('qrcode')
      const txid = `ARK${Date.now().toString(36).toUpperCase()}`
      
      const pixCode = generatePixCode({
        pixKey: ARKIEL_PIX_KEY,
        merchantName: ARKIEL_MERCHANT_NAME.substring(0, 25),
        merchantCity: ARKIEL_MERCHANT_CITY.substring(0, 15),
        amount: parseFloat(total),
        txid,
        description: `Creditos ${credit_type} x${qty}`,
      })
      
      // Gerar QR Code como base64 data URL
      const qrDataUrl = await QRCodeModule.default.toDataURL(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      
      // Criar registro de pagamento
      const meta = JSON.stringify({
        type: 'credit_purchase',
        credit_type,
        quantity: qty,
        unit_price: price.unit,
        total_price: parseFloat(total),
        arkiel_margin: price.arkiel_margin,
        meta_cost: price.meta_cost,
      })
      const { data: payment } = await db.from('payments').insert({
        tenant_id,
        amount: parseFloat(total),
        status: 'pending',
        pix_code: pixCode,
        pix_qr_url: meta,
      }).select().single()
      
      return res.status(200).json({
        ok: true,
        payment_id: payment?.id,
        pix_code: pixCode,
        pix_qr: qrDataUrl,
        amount: parseFloat(total),
        credit_type,
        credit_label: price.label,
        quantity: qty,
        unit_price: price.unit,
        meta_cost_per_unit: price.meta_cost,
        arkiel_margin_per_unit: price.arkiel_margin,
        breakdown: {
          meta_cost: (price.meta_cost * qty).toFixed(2),
          arkiel_margin: (price.arkiel_margin * qty).toFixed(2),
          total: total,
        },
      })
    } catch (e) {
      console.error('Erro ao gerar PIX:', e)
      return res.status(500).json({ error: 'Erro ao gerar PIX: ' + e.message })
    }
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
