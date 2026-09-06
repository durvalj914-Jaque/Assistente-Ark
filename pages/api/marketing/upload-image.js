import { supabase, supabaseAdmin } from '../../../lib/supabase'

/**
 * POST /api/marketing/upload-image
 * Faz upload de uma imagem de marketing para o bucket 'product-images' do Supabase Storage
 * (bucket público compartilhado com produtos). Recebe multipart/form-data com:
 *   - file: imagem (png, jpg, webp)
 * Header: Authorization: Bearer <supabase_session_token>
 * Retorna { imageUrl } — URL pública usada no envio da mensagem de marketing.
 */
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  // Parse multipart
  const { default: formidable } = await import('formidable')
  const form = formidable({ maxFileSize: 5 * 1024 * 1024, keepExtensions: true })

  let fields, files
  try {
    ;[fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })
  } catch (e) {
    return res.status(400).json({ error: 'Erro ao processar arquivo', detail: e.message })
  }

  const file = files.file?.[0] || files.file
  if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' })

  const fs = await import('fs')
  const path = await import('path')

  // Validar tipo
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  const mime = file.mimetype || file.type
  if (!allowed.includes(mime)) {
    return res.status(400).json({ error: 'Formato não suportado. Use PNG, JPG ou WebP.' })
  }

  // Ler arquivo
  const buffer = fs.readFileSync(file.filepath)
  const ext = path.extname(file.originalFilename || file.newFilename || '.png').toLowerCase()
  const fileName = `marketing_${Date.now()}${ext}`

  // Upload para Supabase Storage
  const db = supabaseAdmin()
  const { data: uploadData, error: uploadErr } = await db.storage
    .from('product-images')
    .upload(fileName, buffer, { contentType: mime, cacheControl: '3600' })

  if (uploadErr) return res.status(500).json({ error: 'Erro no upload', detail: uploadErr.message })

  // Obter URL pública
  const { data: urlData } = db.storage.from('product-images').getPublicUrl(fileName)
  const imageUrl = urlData.publicUrl

  // Limpar arquivo temporário
  try { fs.unlinkSync(file.filepath) } catch (_) {}

  return res.status(200).json({ ok: true, imageUrl })
}
