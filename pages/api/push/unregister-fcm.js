/**
 * POST /api/push/unregister-fcm
 * Remove o token FCM deste dispositivo (ex: logout no app).
 * Body: { token }
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

  await db.from('fcm_tokens').delete().eq('token', token).eq('user_id', user.id)
  return res.status(200).json({ ok: true })
}
