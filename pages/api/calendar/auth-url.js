import crypto from 'crypto'
// GET /api/calendar/auth-url?tenantId=... → redireciona pro consentimento do Google
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { tenantId } = req.query
  if (!tenantId) return res.status(400).json({ error: 'tenantId obrigatório' })

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CALENDAR_CLIENT_ID não configurado na Vercel' })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://arkiel.com.br'}/api/calendar/callback`
  // state assinado (HMAC): impede conectar agenda de outro tenant
  const SECRET = process.env.CALENDAR_STATE_SECRET || process.env.META_APP_SECRET || 'ark_secret_arkiel_2025'
  const sig = crypto.createHmac('sha256', SECRET).update(String(tenantId)).digest('hex').slice(0, 16)
  const state = `${tenantId}.${sig}`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
