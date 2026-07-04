/**
 * POST /api/push/register-fcm
 * Registra o token do Firebase Cloud Messaging do app Android nativo.
 * Body: { token: string }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body || {}
  if (!token) return res.status(400).json({ error: 'token é obrigatório' })

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: member } = await db
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Usuário sem tenant' })

  const { error } = await db.from('fcm_tokens').upsert({
    tenant_id: member.tenant_id,
    user_id: user.id,
    token,
    platform: 'android',
  }, { onConflict: 'token' })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
