/**
 * GET /api/conversations/media?conversation_id=xxx
 * Retorna todas as mídias (imagens, vídeos, áudios, documentos) de uma conversa.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const conversationId = req.query.conversation_id
  if (!conversationId) return res.status(400).json({ error: 'conversation_id é obrigatório' })

  const db = supabaseAdmin()

  // Buscar mensagens que contêm mídia (formato __media__:{type}:{media_id}__)
  const { data: messages, error } = await db.from('messages')
    .select('id, content, direction, type, created_at, sent_by')
    .eq('conversation_id', conversationId)
    .in('type', ['image', 'video', 'audio', 'document', 'sticker'])
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return res.status(500).json({ error: error.message })

  // Parsear cada mensagem para extrair tipo, media_id e caption
  const media = (messages || []).map(m => {
    const match = m.content?.match(/^__media__:(\w+):([\w-]+)__(?:\s(.*))?$/s)
    if (!match) return null
    return {
      id: m.id,
      type: match[1],        // image, video, audio, document, sticker
      media_id: match[2],
      caption: match[3]?.trim() || '',
      direction: m.direction, // inbound (recebida) ou outbound (enviada)
      created_at: m.created_at,
      sent_by: m.sent_by,
    }
  }).filter(Boolean)

  // Separar por categoria
  const images = media.filter(m => m.type === 'image')
  const videos = media.filter(m => m.type === 'video')
  const audios = media.filter(m => m.type === 'audio')
  const documents = media.filter(m => m.type === 'document')
  const stickers = media.filter(m => m.type === 'sticker')

  return res.status(200).json({
    media,
    counts: {
      total: media.length,
      images: images.length,
      videos: videos.length,
      audios: audios.length,
      documents: documents.length,
      stickers: stickers.length,
    }
  })
}
