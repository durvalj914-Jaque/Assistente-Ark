// Helper compartilhado pelos endpoints /api/admin/* — garante que só a equipe
// Arkiel (profiles.is_platform_admin = true) consegue chamar essas rotas.
import { supabaseAdmin } from './supabase'

export async function requirePlatformAdmin(req, res, opts = {}) {
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error } = await db.auth.getUser(userToken)
  if (error || !user) {
    res.status(401).json({ error: 'Não autorizado' })
    return null
  }

  const { data: profile } = await db.from('profiles').select('is_platform_admin, totp_enabled, totp_last_ok').eq('id', user.id).maybeSingle()
  if (!profile?.is_platform_admin) {
    res.status(403).json({ error: 'Acesso restrito à equipe Arkiel' })
    return null
  }

  // 2FA enforcement server-side (idem serverAuth.js)
  if (!opts?.skip2fa && profile.totp_enabled) {
    const last = profile.totp_last_ok ? new Date(profile.totp_last_ok).getTime() : 0
    if (!last || Date.now() - last > 8 * 3600 * 1000) {
      res.status(403).json({ error: 'Autenticação de dois fatores necessária (código TOTP).', code: 'TOTP_REQUIRED' })
      return null
    }
  }

  return { db, user }
}
