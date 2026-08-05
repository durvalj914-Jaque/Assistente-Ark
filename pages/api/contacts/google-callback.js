/**
 * GET /api/contacts/google-callback
 * Callback do OAuth do Google. Troca o code por tokens e salva no Supabase.
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect('/painel?tab=contacts&error=' + encodeURIComponent(error))
  }
  if (!code) return res.status(400).json({ error: 'Código ausente' })

  let stateData
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    return res.status(400).json({ error: 'State inválido' })
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientSecret) {
    return res.status(500).json({ error: 'GOOGLE_OAUTH_CLIENT_SECRET não configurado' })
  }

  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/contacts/google-callback`

  // Trocar code por tokens
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
    return res.redirect('/painel?tab=contacts&error=' + encodeURIComponent(tokens.error_description || tokens.error || 'Falha ao obter token'))
  }

  if (!tokens.refresh_token) {
    // Sem refresh_token — o usuário já tinha autorizado antes e não usou prompt=consent
    return res.redirect('/painel?tab=contacts&error=' + encodeURIComponent('Refresh token não recebido. Tente novamente.'))
  }

  const db = supabaseAdmin()

  // Tentar upsert direto — se a tabela não existe, o erro é capturado
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
    // Tabela provavelmente não existe. Tentar criar via SQL.
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (serviceKey) {
      // Tentar criar via REST API do Supabase
      try {
        // O Supabase REST não suporta DDL diretamente, mas podemos tentar via RPC se houver exec_sql
        // Se não, o upsert vai falhar e retornamos erro com instruções
      } catch (e) {}
    }

    return res.redirect('/painel?tab=contacts&error=' + encodeURIComponent('Erro ao salvar token: ' + upsertErr.message + '. A tabela google_contacts_auth pode não existir. Crie no Supabase SQL Editor.'))
  }

  res.redirect('/painel?tab=contacts&synced=1&tenant=' + stateData.tenant_id)
}
