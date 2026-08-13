/**
 * GET /api/admin/mp-diagnostic
 * Mostra qual tenant tem mp_access_token e qual é o user logado.
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db, user } = ctx

  // 1. Qual tenant o useTenant resolveria para este user?
  const { data: myMember } = await db.from('tenant_members')
    .select('tenant_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // 2. Todos os tenants com MP conectado
  const { data: allTenants } = await db.from('tenants')
    .select('id, name, mp_access_token, created_at')
    .order('created_at', { ascending: true })

  const tenantsWithMP = (allTenants || []).map(t => {
    let mpInfo = null
    if (t.mp_access_token) {
      try {
        const parsed = JSON.parse(t.mp_access_token)
        mpInfo = {
          user_id: parsed.user_id,
          user_nickname: parsed.user_nickname,
          has_access_token: !!parsed.access_token,
          has_refresh_token: !!parsed.refresh_token,
          expires_at: parsed.expires_at,
          fee_config: parsed.fee_config || null,
          mp_methods: parsed.mp_methods || null,
        }
      } catch {
        mpInfo = { raw: t.mp_access_token.substring(0, 30) + '...' }
      }
    }
    return {
      tenant_id: t.id,
      tenant_name: t.name,
      has_mp: !!t.mp_access_token,
      mp_info: mpInfo,
    }
  })

  // 3. Limpar mp_access_token de um tenant específico (POST com body)
  if (req.method === 'POST' && req.body?.clear_tenant_id) {
    const targetId = req.body.clear_tenant_id
    const { error } = await db.from('tenants')
      .update({ mp_access_token: null })
      .eq('id', targetId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, message: 'mp_access_token limpo do tenant ' + targetId })
  }

  return res.status(200).json({
    current_user: user.email,
    my_memberships: myMember || [],
    all_tenants: tenantsWithMP,
  })
}
