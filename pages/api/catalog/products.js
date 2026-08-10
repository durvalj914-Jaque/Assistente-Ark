/**
 * GET /api/catalog/products?tenant=xxx
 * Lista produtos ativos de um tenant — pública (sem auth).
 * Usada pela vitrine pública /catalog/[tenantId]
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant } = req.query
  if (!tenant) return res.status(400).json({ error: 'tenant é obrigatório' })

  const db = supabaseAdmin()

  // Buscar tenant + bot (para número WhatsApp)
  const [{ data: tenantData }, { data: botData }] = await Promise.all([
    db.from('tenants').select('id, name, pix_key, merchant_name, merchant_city').eq('id', tenant).maybeSingle(),
    db.from('bots').select('id, phone_number_id, name').eq('tenant_id', tenant).limit(1).maybeSingle(),
  ])

  if (!tenantData) return res.status(404).json({ error: 'Loja não encontrada' })

  // Buscar WhatsApp display number
  let whatsappNumber = null
  if (botData?.phone_number_id) {
    const token = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${botData.phone_number_id}?fields=display_phone_number&access_token=${token}`)
      const d = await r.json()
      whatsappNumber = d.display_phone_number?.replace(/\D/g, '') || null
    } catch (_) {}
  }

  // Buscar produtos ativos
  const { data: products, error } = await db.from('products')
    .select('id, name, description, price, image_url, category, stock, is_active')
    .eq('tenant_id', tenant)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    store: {
      name: tenantData.name,
      whatsappNumber,
      pixKey: tenantData.pix_key,
      merchantName: tenantData.merchant_name,
      merchantCity: tenantData.merchant_city,
    },
    products: products || [],
  })
}
