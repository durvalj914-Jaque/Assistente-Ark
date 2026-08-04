import { createClient } from '@supabase/supabase-js'

const TOKEN = process.env.META_SYSTEM_USER_TOKEN
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1055720357624339'
const GRAPH = 'https://graph.facebook.com/v25.0'
const SETUP_SECRET = process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const secret = req.headers['x-setup-secret'] || req.query.secret
  if (secret !== SETUP_SECRET) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${GRAPH}/${PHONE_ID}/whatsapp_commerce_settings?access_token=${TOKEN}`)
      const data = await r.json()
      return res.status(200).json({ settings: data, phone_id: PHONE_ID })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { is_catalog_visible, is_cart_enabled } = req.body
    try {
      const body = new URLSearchParams()
      if (typeof is_catalog_visible === 'boolean') body.append('is_catalog_visible', is_catalog_visible)
      if (typeof is_cart_enabled === 'boolean') body.append('is_cart_enabled', is_cart_enabled)
      body.append('access_token', TOKEN)

      const r = await fetch(`${GRAPH}/${PHONE_ID}/whatsapp_commerce_settings`, {
        method: 'POST',
        body,
      })
      const data = await r.json()
      if (data.error) return res.status(400).json(data)
      return res.status(200).json({ success: true, ...data })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
