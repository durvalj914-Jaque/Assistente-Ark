/**
 * POST /api/conversations/toggle-bot
 * Alterna o status da conversa entre 'no_bot' e 'bot'.
 * Body: { conversation_id: string, no_bot: boolean }
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversation_id, no_bot } = req.body
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id é obrigatório' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  const { data: conv } = await db.from('conversations').select('id, tenant_id, status').eq('id', conversation_id).maybeSingle()
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // Verificar permissão
  const { data: profile } = await db.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).eq('tenant_id', conv.tenant_id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
  }

  const newStatus = no_bot ? 'no_bot' : 'bot'
  const { error } = await db.from('conversations').update({ status: newStatus }).eq('id', conversation_id)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true, status: newStatus })
}
