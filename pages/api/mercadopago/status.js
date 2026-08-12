import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Sem tenant' })

  const { data: tenant } = await db.from('tenants').select('id, name, mp_access_token').eq('id', member.tenant_id).maybeSingle()

  const hasOwnToken = !!tenant?.mp_access_token
  let tokenInfo = null
  if (hasOwnToken) {
    try {
      const parsed = JSON.parse(tenant.mp_access_token)
      tokenInfo = {
        user_id: parsed.user_id,
        user_nickname: parsed.user_nickname,
        expires_at: parsed.expires_at,
        has_access_token: !!parsed.access_token,
        has_refresh_token: !!parsed.refresh_token,
      }
    } catch {
      tokenInfo = { raw: tenant.mp_access_token.substring(0, 20) + '...' }
    }
  }

  return res.status(200).json({
    tenant_id: member.tenant_id,
    tenant_name: tenant?.name,
    mp_connected: hasOwnToken,
    using_platform_token: !hasOwnToken,
    token_info: tokenInfo,
  })
}
