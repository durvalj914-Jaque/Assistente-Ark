/**
 * POST /api/admin/ensure-media-columns
 * Adiciona colunas media_id e media_caption na tabela messages se não existirem.
 * Protegido por x-setup-key.
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const setupKey = req.headers['x-setup-key']
  if (setupKey !== (process.env.SETUP_SECRET || 'arkiel-setup-2026')) {
    return res.status(403).json({ error: 'Não autorizado' })
  }

  const db = supabaseAdmin()
  const results = []

  // Tentar adicionar coluna media_id
  try {
    const { error } = await db.rpc('exec_sql', {
      sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_id text;`
    })
    results.push({ column: 'media_id', ok: !error, error: error?.message })
  } catch (e) {
    results.push({ column: 'media_id', ok: false, error: e.message })
  }

  // Tentar adicionar coluna media_caption
  try {
    const { error } = await db.rpc('exec_sql', {
      sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_caption text;`
    })
    results.push({ column: 'media_caption', ok: !error, error: error?.message })
  } catch (e) {
    results.push({ column: 'media_caption', ok: false, error: e.message })
  }

  return res.status(200).json({ ok: true, results })
}
