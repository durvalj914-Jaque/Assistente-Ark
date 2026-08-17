import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  const tenantId = req.query.tenant_id || 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  
  const { data: tenant } = await db.from('tenants')
    .select('id, name, mp_access_token')
    .eq('id', tenantId)
    .maybeSingle()
  
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  
  let tokenInfo = { has_mp_access_token: !!tenant.mp_access_token }
  let token = null
  
  if (tenant.mp_access_token) {
    try {
      const parsed = JSON.parse(tenant.mp_access_token)
      tokenInfo = {
        ...tokenInfo,
        has_access_token: !!parsed.access_token,
        has_refresh_token: !!parsed.refresh_token,
        expires_at: parsed.expires_at,
        user_id: parsed.user_id,
        user_nickname: parsed.user_nickname,
        access_token_prefix: parsed.access_token ? parsed.access_token.substring(0, 10) + '...' : null,
        fee_config: parsed.fee_config || null,
        keys: Object.keys(parsed),
      }
      token = parsed.access_token
    } catch (e) {
      tokenInfo = { ...tokenInfo, parse_error: e.message, raw_prefix: tenant.mp_access_token.substring(0, 30) }
      token = tenant.mp_access_token
    }
  }
  
  // Test the token against MP API
  let mpTest = null
  if (token) {
    try {
      const mpRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      mpTest = {
        status: mpRes.status,
        ok: mpRes.ok,
        body: mpRes.ok ? (await mpRes.json()).nickname : (await mpRes.json()).message
      }
    } catch (e) {
      mpTest = { error: e.message }
    }
  }
  
  // Also test with platform token
  let platformTest = null
  const platformToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
  if (platformToken) {
    try {
      const mpRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${platformToken}` }
      })
      platformTest = {
        status: mpRes.status,
        ok: mpRes.ok,
        body: mpRes.ok ? (await mpRes.json()).nickname : (await mpRes.json()).message
      }
    } catch (e) {
      platformTest = { error: e.message }
    }
  }
  
  return res.status(200).json({ tenant_id: tenantId, tenant_name: tenant.name, token_info: tokenInfo, mp_test: mpTest, platform_test: platformTest })
}
