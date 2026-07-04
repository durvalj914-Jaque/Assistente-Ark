// Helper compartilhado pelos endpoints /api/admin/* — garante que só a equipe
// Arkiel (profiles.is_platform_admin = true) consegue chamar essas rotas.
import { supabaseAdmin } from './supabase'

export async function requirePlatformAdmin(req, res) {
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error } = await db.auth.getUser(userToken)
  if (error || !user) {
    res.status(401).json({ error: 'Não autorizado' })
    return null
  }

  const { data: profile } = await db.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_platform_admin) {
    res.status(403).json({ error: 'Acesso restrito à equipe Arkiel' })
    return null
  }

  return { db, user }
}
