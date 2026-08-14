/**
 * POST /api/push/settings
 * Salva as configurações de notificação por tipo de evento no tenant.
 * Body: { settings: { human_handoff: { enabled, sound, vibration }, ... } }
 */
import { supabaseAdmin } from '../../../lib/supabase'

const VALID_TYPES = ['human_handoff', 'no_bot_message', 'new_order', 'receipt', 'loop_detected']
const VALID_SOUNDS = ['none', 'gentle', 'normal', 'urgent', 'alert']
const VALID_VIBRATIONS = ['none', 'gentle', 'normal', 'urgent', 'alert']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: member } = await db
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Usuário sem tenant' })

  const { settings } = req.body || {}

  // Validate settings
  const cleanSettings = {}
  for (const [key, val] of Object.entries(settings || {})) {
    if (!VALID_TYPES.includes(key)) continue
    cleanSettings[key] = {
      enabled: !!val.enabled,
      sound: VALID_SOUNDS.includes(val.sound) ? val.sound : 'normal',
      vibration: VALID_VIBRATIONS.includes(val.vibration) ? val.vibration : 'normal',
    }
  }

  const { error } = await db
    .from('tenants')
    .update({ notification_settings: cleanSettings })
    .eq('id', member.tenant_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
