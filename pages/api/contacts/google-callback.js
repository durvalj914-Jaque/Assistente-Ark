/**
 * GET /api/contacts/google-callback
 * Callback do OAuth do Google. Troca o code por tokens e salva no Supabase.
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const { code, state, error } = req.query

  const contactsPage = '/admin/contacts'

  if (error) {
    return res.redirect(`${contactsPage}?google_error=` + encodeURIComponent(error))
  }
  if (!code) return res.status(400).json({ error: 'Código ausente' })

  let stateData
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    return res.redirect(`${contactsPage}?google_error=` + encodeURIComponent('State inválido'))
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientSecret) {
    return res.redirect(`${contactsPage}?google_error=` + encodeURIComponent('GOOGLE_OAUTH_CLIENT_SECRET não configurado'))
  }

  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/contacts/google-callback`

  // Trocar code por tokens
  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      })
    })

    const tokens = await tokenResp.json()

    if (!tokenResp.ok) {
      return res.redirect(`${contactsPage}?google_error=` + encodeURIComponent(tokens.error_description || tokens.error || 'Falha ao obter token'))
    }

    if (!tokens.refresh_token) {
      return res.redirect(`${contactsPage}?google_error=` + encodeURIComponent('Refresh token não recebido. Revogue o acesso em myaccount.google.com e tente novamente.'))
    }

    const db = supabaseAdmin()
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

    const { error: upsertErr } = await db
      .from('google_contacts_auth')
      .upsert({
        tenant_id: stateData.tenant_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope,
        token_type: tokens.token_type,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })

    if (upsertErr) {
      return res.redirect(`${contactsPage}?google_error=` + encodeURIComponent('Erro ao salvar: ' + upsertErr.message))
    }

    res.redirect(`${contactsPage}?google_connected=1`)
  } catch (e) {
    res.redirect(`${contactsPage}?google_error=` + encodeURIComponent(e.message))
  }
}
