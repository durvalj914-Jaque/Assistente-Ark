/**
 * GET  /api/whatsapp/profile-photo?bot_id=xxx  -> retorna a foto de perfil atual do WhatsApp Business
 * POST /api/whatsapp/profile-photo             -> troca a foto de perfil
 *   Body: { bot_id, file_base64, mime_type }
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * - Confirma que o usuário autenticado pertence ao tenant dono do bot.
 * - Usa o access_token e phone_number_id armazenados no bot (nunca confia em token vindo do cliente).
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { getBusinessProfile, updateProfilePhoto } from '../../../lib/meta'

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } }
}

const META_APP_ID = process.env.META_APP_ID || '1233523595601487'

async function authorizeBot(req, res, botId) {
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) { res.status(401).json({ error: 'Não autorizado' }); return null }

  const { data: bot, error: botErr } = await db
    .from('bots').select('id, tenant_id, phone_number_id, access_token').eq('id', botId).single()
  if (botErr || !bot) { res.status(404).json({ error: 'Bot não encontrado' }); return null }

  const { data: member } = await db
    .from('tenant_members').select('role')
    .eq('tenant_id', bot.tenant_id).eq('user_id', user.id).maybeSingle()
  if (!member) { res.status(403).json({ error: 'Acesso negado a este bot' }); return null }

  if (!bot.phone_number_id || !bot.access_token) {
    res.status(400).json({ error: 'Este bot ainda não tem número/token da Meta configurados' })
    return null
  }

  return bot
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { bot_id } = req.query
    if (!bot_id) return res.status(400).json({ error: 'bot_id é obrigatório' })
    const bot = await authorizeBot(req, res, bot_id)
    if (!bot) return

    try {
      const { data } = await getBusinessProfile(bot.phone_number_id, bot.access_token)
      const profile = data?.data?.[0] || {}
      return res.status(200).json({ profile_picture_url: profile.profile_picture_url || null })
    } catch (e) {
      console.error('[whatsapp/profile-photo][GET]', e?.response?.data || e.message)
      return res.status(500).json({ error: 'Não foi possível buscar a foto atual na Meta' })
    }
  }

  if (req.method === 'POST') {
    const { bot_id, file_base64, mime_type } = req.body || {}
    if (!bot_id || !file_base64 || !mime_type) {
      return res.status(400).json({ error: 'bot_id, file_base64 e mime_type são obrigatórios' })
    }
    if (!['image/jpeg', 'image/png'].includes(mime_type)) {
      return res.status(400).json({ error: 'Use uma imagem JPEG ou PNG' })
    }

    const bot = await authorizeBot(req, res, bot_id)
    if (!bot) return

    try {
      const buffer = Buffer.from(file_base64, 'base64')
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Imagem muito grande (máximo 5MB)' })
      }
      await updateProfilePhoto(bot.phone_number_id, bot.access_token, META_APP_ID, buffer, mime_type)
      return res.status(200).json({ ok: true })
    } catch (e) {
      console.error('[whatsapp/profile-photo][POST]', e?.response?.data || e.message)
      const metaError = e?.response?.data?.error?.message
      return res.status(500).json({ error: metaError || 'Não foi possível atualizar a foto na Meta' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
