/**
 * /api/mercadopago/oauth/callback
 * Recebe o code, troca por tokens, salva no tenant
 */
import { createClient } from '@supabase/supabase-js'

const MP_CLIENT_ID = '3158906703766924'
const MP_CLIENT_SECRET = process.env.MERCADO_PAGO_CLIENT_SECRET_3
const REDIRECT_URI = 'https://arkiel.com.br/api/mercadopago/oauth/callback'

export default async function handler(req, res) {
  const { code, state, error } = req.query
  
  if (error) {
    return res.redirect(302, `/admin/financeiro?tab=billing_methods&mp_error=${encodeURIComponent(error)}`)
  }
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' })
  }
  
  const tenantId = state
  
  try {
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 
        'accept': 'application/json',
        'Content-Type': 'application/json' 
      },
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
      console.error('[mp-oauth] Token exchange failed:', JSON.stringify(tokenData))
      return res.redirect(302, `/admin/financeiro?tab=billing_methods&mp_error=${encodeURIComponent(tokenData.message || tokenData.error || 'Falha na troca de token')}`)
    }
    
    const userRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userData = await userRes.json()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    
    const tokenBundle = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      public_key: tokenData.public_key || null,
      user_id: userData.id || null,
      user_nickname: userData.nickname || userData.first_name || '',
      expires_at: new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString()
    })
    
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ mp_access_token: tokenBundle })
      .eq('id', tenantId)
    
    if (updateError) {
      console.error('[mp-oauth] Save error:', updateError)
      return res.redirect(302, `/admin/financeiro?tab=billing_methods&mp_error=${encodeURIComponent('Erro ao salvar credenciais')}`)
    }
    
    return res.redirect(302, `/admin/financeiro?tab=billing_methods&mp_success=1&mp_user=${encodeURIComponent(userData.nickname || '')}`)
    
  } catch (e) {
    console.error('[mp-oauth] Exception:', e)
    return res.redirect(302, `/admin/financeiro?tab=billing_methods&mp_error=${encodeURIComponent('Erro inesperado')}`)
  }
}
