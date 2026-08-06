/**
 * POST /api/conversations/delete
 * Deleta uma conversa e todas as suas mensagens.
 * Usa service role key (bypassa RLS).
 * Body: { conversation_id: string }
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversation_id } = req.body
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id é obrigatório' })

  // Verificar autenticação
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Verificar que a conversa pertence ao tenant do usuário
  const { data: conv } = await db
    .from('conversations')
    .select('id, tenant_id')
    .eq('id', conversation_id)
    .maybeSingle()

  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // Verificar permissão
  const { data: profile } = await db
    .from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  const isPlatformAdmin = profile?.is_platform_admin || false

  if (!isPlatformAdmin) {
    const { data: member } = await db
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', conv.tenant_id)
      .maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
  }

  // Deletar mensagens primeiro
  const { error: msgErr } = await db
    .from('messages')
    .delete()
    .eq('conversation_id', conversation_id)

  if (msgErr) {
    return res.status(500).json({ error: 'Erro ao deletar mensagens', detail: msgErr.message })
  }

  // Deletar a conversa
  const { error: convErr } = await db
    .from('conversations')
    .delete()
    .eq('id', conversation_id)

  if (convErr) {
    return res.status(500).json({ error: 'Erro ao deletar conversa', detail: convErr.message })
  }

  return res.status(200).json({ ok: true, deleted: conversation_id })
}
