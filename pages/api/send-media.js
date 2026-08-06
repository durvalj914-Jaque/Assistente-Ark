/**
 * POST /api/send-media
 * Envia mídia (imagem, vídeo, documento, áudio) via WhatsApp.
 * Recebe multipart/form-data com:
 *   - conversation_id: string
 *   - caption: string (opcional)
 *   - file: arquivo de mídia
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../lib/supabase'
import { uploadMedia, sendMedia, getMediaType } from '../../lib/meta'

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Parse multipart form data manualmente (Next.js não tem parser nativo com bodyParser: false)
  const { default: formidable } = await import('formidable')
  
  // formidable v3 usa Promise
  const form = formidable({ 
    maxFileSize: 50 * 1024 * 1024, // 50MB (limite do WhatsApp para a maioria dos tipos)
    keepExtensions: true,
  })

  let fields, files
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })
  } catch (e) {
    return res.status(400).json({ error: 'Erro ao processar arquivo', detail: e.message })
  }

  // formidable v5 retorna arrays; v3 pode retornar valores diretos
  const conversationId = Array.isArray(fields.conversation_id) ? fields.conversation_id[0] : fields.conversation_id
  const caption = Array.isArray(fields.caption) ? fields.caption[0] : fields.caption || ''
  const file = Array.isArray(files.file) ? files.file[0] : files.file

  if (!conversationId) return res.status(400).json({ error: 'conversation_id é obrigatório' })
  if (!file) return res.status(400).json({ error: 'Arquivo é obrigatório' })

  // Autenticar usuário
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  // Buscar conversa + bot + contato
  const { data: conv, error: convErr } = await db
    .from('conversations')
    .select('*, bots(id, phone_number_id, access_token), contacts(id, phone)')
    .eq('id', conversationId)
    .single()

  if (convErr || !conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // Verificar acesso do usuário ao tenant
  const { data: member } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', conv.tenant_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a esta conversa' })

  if (conv.status === 'closed') {
    return res.status(400).json({ error: 'Esta conversa está encerrada' })
  }

  const bot = conv.bots
  const contact = conv.contacts
  const token = bot?.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2 || process.env.WHATSAPP_ACCESS_TOKEN

  if (!bot?.phone_number_id || !contact?.phone || !token) {
    return res.status(500).json({ error: 'Configuração do bot incompleta' })
  }

  // Ler o arquivo do disco
  const fs = await import('fs')
  const path = await import('path')
  const fileBuffer = fs.readFileSync(file.filepath)
  const mimeType = file.mimetype || 'application/octet-stream'
  const originalName = file.originalFilename || 'arquivo'
  const mediaType = getMediaType(mimeType)

  try {
    // 1. Upload para a Meta
    const mediaId = await uploadMedia(bot.phone_number_id, token, fileBuffer, originalName, mimeType)

    // 2. Enviar mensagem com mídia
    await sendMedia(bot.phone_number_id, token, contact.phone, mediaType, mediaId, caption || undefined, originalName)

    // 3. Salvar no Supabase — codifica media_id no content
    const icon = mediaType === 'image' ? '🖼️' : mediaType === 'video' ? '🎬' : mediaType === 'audio' ? '🎵' : '📎'
    const captionText = caption || originalName
    const messageContent = `__media__:${mediaType}:${mediaId}__ ${icon} ${captionText}`

    await db.from('messages').insert({
      tenant_id: conv.tenant_id,
      conversation_id: conv.id,
      bot_id: bot.id,
      contact_id: contact.id,
      direction: 'outbound',
      type: mediaType,
      content: messageContent,
      sent_by: 'human',
    })

    // Atualizar conversa
    const convUpdate = {
      last_message: messageContent,
      last_message_at: new Date().toISOString(),
    }
    if (conv.status !== 'human') convUpdate.status = 'human'
    await db.from('conversations').update(convUpdate).eq('id', conv.id)

    // Limpar arquivo temporário
    try { fs.unlinkSync(file.filepath) } catch {}

    return res.status(200).json({ ok: true, media_id: mediaId, type: mediaType })
  } catch (err) {
    try { fs.unlinkSync(file.filepath) } catch {}
    console.error('[send-media] erro:', err?.response?.data || err.message)
    return res.status(502).json({ 
      error: 'Falha ao enviar mídia via WhatsApp', 
      detail: err?.response?.data || err.message 
    })
  }
}
