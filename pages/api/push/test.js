/**
 * POST /api/push/test
 * Manda uma notificação de teste pro próprio tenant do usuário logado.
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { sendPushToTenant } from '../../../lib/webpush'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: member } = await db
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Usuário sem tenant' })

  await sendPushToTenant(member.tenant_id, {
    title: '🔔 Notificação de teste',
    body: 'Se você recebeu isso com som e vibração, tá tudo funcionando!',
    url: '/admin/settings',
    tag: 'ark-test',
  })

  return res.status(200).json({ ok: true })
}
