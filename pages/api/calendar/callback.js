// GET /api/calendar/callback?code=...&state=<tenantId> → troca code por tokens e salva conexão
import { createClient } from '@supabase/supabase-js'
import { getGoogleOAuthCreds } from '../../../lib/googleCalendar'

function getDB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const { code, state: tenantId, error } = req.query
  const back = (msg) => res.redirect(`/admin/products?tab=horarios&cal=${msg}`)

  if (error || !code || !tenantId) return back('erro')

  const { clientId, clientSecret } = getGoogleOAuthCreds()
  if (!clientId || !clientSecret) return back('nao_configurado')

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'https://arkiel.com.br'}/api/calendar/callback`
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    })
    const tok = await r.json()
    if (!tok.refresh_token) return back('sem_permissao')

    // E-mail da conta conectada
    let email = null
    try {
      const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      })
      email = (await u.json()).email || null
    } catch (_) {}

    const db = getDB()
    const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString()
    const { data: existing } = await db.from('calendar_connections').select('id, ics_token').eq('tenant_id', tenantId).maybeSingle()

    if (existing) {
      await db.from('calendar_connections').update({
        google_email: email, access_token: tok.access_token, refresh_token: tok.refresh_token,
        token_expires_at: expiresAt, updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      await db.from('calendar_connections').insert({
        tenant_id: tenantId, google_email: email, access_token: tok.access_token,
        refresh_token: tok.refresh_token, token_expires_at: expiresAt,
      })
    }
    return back('conectado')
  } catch (_) {
    return back('erro')
  }
}
