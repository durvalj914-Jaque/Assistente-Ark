/**
 * POST /api/push/subscribe
 * Registra a inscrição de push do navegador/dispositivo do usuário logado.
 * Body: { subscription: PushSubscriptionJSON }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { subscription } = req.body || {}
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'subscription inválida' })
  }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: member } = await db
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Usuário sem tenant' })

  const { error } = await db.from('push_subscriptions').upsert({
    tenant_id: member.tenant_id,
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: req.headers['user-agent'] || null,
  }, { onConflict: 'endpoint' })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
