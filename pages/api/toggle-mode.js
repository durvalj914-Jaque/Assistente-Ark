/**
 * POST /api/toggle-mode
 * Alterna uma conversa entre atendimento por Bot e Humano (switch manual, sem enviar mensagem).
 * Body: { conversation_id, mode }  -> mode: 'bot' | 'human'
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversation_id, mode } = req.body || {}
  if (!conversation_id || !['bot', 'human'].includes(mode)) {
    return res.status(400).json({ error: 'conversation_id e mode (bot|human) são obrigatórios' })
  }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: conv, error: convErr } = await db
    .from('conversations').select('id, tenant_id, status').eq('id', conversation_id).single()
  if (convErr || !conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  const { data: member } = await db
    .from('tenant_members').select('role')
    .eq('tenant_id', conv.tenant_id).eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a esta conversa' })

  if (conv.status === 'closed') return res.status(400).json({ error: 'Esta conversa está encerrada' })

  const update = { status: mode }
  // Ao devolver para o bot, reinicia o fluxo a partir do menu principal.
  if (mode === 'bot') update.current_node_id = null

  await db.from('conversations').update(update).eq('id', conversation_id)

  return res.status(200).json({ ok: true })
}
