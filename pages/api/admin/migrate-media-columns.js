/**
 * POST /api/admin/migrate-media-columns
 * Adiciona colunas media_id e media_caption na tabela messages.
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

  for (const col of ['media_id', 'media_caption']) {
    try {
      const { error } = await db.rpc('exec_sql', {
        sql: `ALTER TABLE messages ADD COLUMN IF NOT EXISTS ${col} text;`
      })
      results.push({ column: col, ok: !error, error: error?.message })
    } catch (e) {
      results.push({ column: col, ok: false, error: e.message })
    }
  }

  return res.status(200).json({ ok: true, results })
}
