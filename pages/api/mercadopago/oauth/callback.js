/**
 * /api/mercadopago/oauth/callback
 * Recebe o code, troca por tokens, salva no tenant
 * Redirect de volta para a pagina correta (admin ou client)
 */
import { createClient } from '@supabase/supabase-js'

const MP_CLIENT_ID = '3158906703766924'
const REDIRECT_URI = 'https://arkiel.com.br/api/mercadopago/oauth/callback'

export default async function handler(req, res) {
  const { code, state, error } = req.query
  
  // Parse state: "tenant_id|return_to" or just "tenant_id" (legacy)
  const stateParts = state ? state.split('|') : []
  const tenantId = stateParts[0] || state
  const returnTo = stateParts[1] || 'admin'
  
  // Determine redirect base
  const redirectBase = returnTo === 'client' 
    ? '/client?tab=financeiro' 
    : '/admin/financeiro?tab=billing_methods'
  
  if (error) {
    return res.redirect(302, `${redirectBase}&mp_error=${encodeURIComponent(error)}`)
  }
  
  if (!code || !tenantId) {
    return res.redirect(302, `${redirectBase}&mp_error=${encodeURIComponent('Code ou tenant ausente')}`)
  }
  
  // Get client secret from multiple possible env vars
  const MP_CLIENT_SECRET = process.env.MERCADO_PAGO_CLIENT_SECRET_3 
    || process.env.MERCADO_PAGO_CLIENT_SECRET_2
    || process.env.MERCADO_PAGO_CLIENT_SECRET
  
  if (!MP_CLIENT_SECRET) {
    console.error('[mp-oauth] CLIENT_SECRET not set in env vars')
    return res.redirect(302, `${redirectBase}&mp_error=${encodeURIComponent('Configuração do MP incompleta (client secret)')}`)
  }
  
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
      const errMsg = tokenData.message || tokenData.error || 'Falha na troca de token'
      return res.redirect(302, `${redirectBase}&mp_error=${encodeURIComponent(errMsg)}`)
    }
    
    // Fetch user info
    const userRes = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const userData = await userRes.json()
    
    // Fetch payment methods to store in bundle
    let mpMethods = {}
    try {
      const methodsRes = await fetch('https://api.mercadopago.com/v1/payment_methods', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      })
      const methodsData = await methodsRes.json()
      const relevantTypes = ['bank_transfer', 'credit_card', 'debit_card', 'ticket', 'account_money']
      for (const m of methodsData) {
        if (relevantTypes.includes(m.payment_type_id)) {
          if (m.payment_type_id === 'bank_transfer' && m.id === 'pix') mpMethods.pix = true
          else if (m.payment_type_id === 'credit_card') mpMethods.credit_card = true
          else if (m.payment_type_id === 'debit_card') mpMethods.debit_card = true
          else if (m.payment_type_id === 'ticket') mpMethods.boleto = true
          else if (m.payment_type_id === 'account_money') mpMethods.account_money = true
        }
      }
    } catch (e) { console.error('[mp-oauth] methods fetch error:', e.message) }
    
    // Save to database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    
    const tokenBundle = JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      public_key: tokenData.public_key || null,
      user_id: userData.id || null,
      user_nickname: userData.nickname || userData.first_name || '',
      user_email: userData.email || '',
      expires_at: new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString(),
      mp_methods: mpMethods,
    })
    
    const { error: updateError } = await supabase
      .from('tenants')
      .update({ mp_access_token: tokenBundle })
      .eq('id', tenantId)
    
    if (updateError) {
      console.error('[mp-oauth] Save error:', updateError)
      return res.redirect(302, `${redirectBase}&mp_error=${encodeURIComponent('Erro ao salvar credenciais: ' + updateError.message)}`)
    }
    
    console.log(`[mp-oauth] Token saved for tenant ${tenantId}, user ${userData.nickname || userData.email}`)
    
    return res.redirect(302, `${redirectBase}&mp_success=1&mp_user=${encodeURIComponent(userData.nickname || '')}`)
    
  } catch (e) {
    console.error('[mp-oauth] Exception:', e)
    return res.redirect(302, `${redirectBase}&mp_error=${encodeURIComponent('Erro inesperado: ' + e.message)}`)
  }
}
