/**
 * GET /api/contacts/google-auth?tenant_id=xxx
 * Inicia o fluxo OAuth do Google para acesso aos contatos.
 * Redireciona o usuário para a tela de consentimento do Google.
 */
export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const tenantId = req.query.tenant_id

  if (!clientId) return res.status(500).json({ error: 'GOOGLE_OAUTH_CLIENT_ID não configurado' })
  if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/contacts/google-callback`
  
  const scopes = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ')

  const state = Buffer.from(JSON.stringify({ tenant_id: tenantId, ts: Date.now() })).toString('base64url')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  res.redirect(authUrl.toString())
}
