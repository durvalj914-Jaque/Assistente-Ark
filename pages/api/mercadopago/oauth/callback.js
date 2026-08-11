/**
 * /api/mercadopago/oauth/callback
 * Recebe o code do OAuth do Mercado Pago, troca por tokens, salva no tenant
 */
import { createClient } from '@supabase/supabase-js'

const MP_CLIENT_ID = '4905810356503706'
const MP_CLIENT_SECRET = process.env.MERCADO_PAGO_CLIENT_SECRET
const REDIRECT_URI = 'https://arkiel.com.br/api/mercadopago/oauth/callback'

export default async function handler(req, res) {
  const { code, state, error } = req.query
  
  if (error) {
    return res.redirect(302, `/client?mp_error=${encodeURIComponent(error)}`)
  }
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' })
  }
  
  const tenantId = state
  
  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    })
    
    const tokenData = await tokenRes.json()
    
    if (!tokenData.access_token) {
      console.error('[mp-oauth] Token exchange failed:', tokenData)
      return res.redirect(302, `/client?mp_error=${encodeURIComponent(tokenData.message || 'Falha na troca de token')}`)
    }
    
    // Get user info from MP
    const userRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userData = await userRes.json()
    
    // Save tokens to tenant
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString()
    
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        mp_access_token: tokenData.access_token,
        mp_refresh_token: tokenData.refresh_token || null,
        mp_public_key: tokenData.public_key || null,
        mp_user_id: userData.id || null,
        mp_expires_at: expiresAt
      })
      .eq('id', tenantId)
    
    if (updateError) {
      console.error('[mp-oauth] Save error:', updateError)
      return res.redirect(302, `/client?mp_error=${encodeURIComponent('Erro ao salvar credenciais')}`)
    }
    
    return res.redirect(302, `/client?mp_success=1&mp_user=${encodeURIComponent(userData.nickname || '')}`)
    
  } catch (e) {
    console.error('[mp-oauth] Exception:', e)
    return res.redirect(302, `/client?mp_error=${encodeURIComponent('Erro inesperado')}`)
  }
}
