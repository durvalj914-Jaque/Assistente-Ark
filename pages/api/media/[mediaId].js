/**
 * GET /api/media/{mediaId}?bot_id=xxx
 * Proxy de mídia recebida do WhatsApp Cloud API.
 * A Meta retorna uma URL temporária que expira; este endpoint busca a URL
 * em tempo real e faz stream do arquivo para o navegador.
 * 
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { mediaId } = req.query
  const botId = req.query.bot_id

  if (!mediaId) return res.status(400).json({ error: 'mediaId é obrigatório' })

  // Autenticar
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  // Buscar o bot para pegar o access_token
  let token = process.env.WHATSAPP_ACCESS_TOKEN_2 || process.env.WHATSAPP_ACCESS_TOKEN
  let phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (botId) {
    const { data: bot } = await db.from('bots').select('access_token, phone_number_id, tenant_id').eq('id', botId).maybeSingle()
    if (bot?.access_token) token = bot.access_token
    if (bot?.phone_number_id) phoneId = bot.phone_number_id

    // Verificar acesso ao tenant
    if (bot?.tenant_id) {
      const { data: member } = await db.from('tenant_members').select('role').eq('tenant_id', bot.tenant_id).eq('user_id', user.id).maybeSingle()
      if (!member) return res.status(403).json({ error: 'Acesso negado' })
    }
  }

  try {
    // 1. Buscar URL da mídia na Meta
    const metaResp = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    
    if (!metaResp.ok) {
      const errBody = await metaResp.text()
      console.error('[media] Meta error:', errBody)
      return res.status(502).json({ error: 'Falha ao buscar mídia na Meta', detail: errBody })
    }

    const mediaData = await metaResp.json()
    const mediaUrl = mediaData.url
    const mimeType = mediaData.mime_type || 'application/octet-stream'
    const filename = mediaData.filename || `media_${mediaId}`

    if (!mediaUrl) return res.status(404).json({ error: 'URL da mídia não encontrada' })

    // 2. Baixar o arquivo da Meta
    const fileResp = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!fileResp.ok) return res.status(502).json({ error: 'Falha ao baixar arquivo' })

    // 3. Stream para o navegador
    const contentType = fileResp.headers.get('content-type') || mimeType
    const contentLength = fileResp.headers.get('content-length')
    
    res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    
    const buffer = Buffer.from(await fileResp.arrayBuffer())
    res.send(buffer)
  } catch (err) {
    console.error('[media] error:', err.message)
    return res.status(500).json({ error: 'Erro ao servir mídia', detail: err.message })
  }
}
