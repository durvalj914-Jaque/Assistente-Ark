/**
 * POST /api/whatsapp/disconnect
 * Auto-atendimento: o próprio usuário desconecta seu WhatsApp.
 * - Deregistra o número na Meta
 * - Limpa phone_number_id, waba_id do bot
 * - Marca bot como inativo
 * - Não deleta conversas/mensagens (mantém histórico)
 * - Não deleta o tenant nem a conta do usuário
 * 
 * Body: { bot_id: string }
 * Requer: sessão autenticada (usuário dono do bot)
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bot_id } = req.body
  if (!bot_id) return res.status(400).json({ error: 'bot_id é obrigatório' })

  // Autenticar via header Bearer
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Buscar o tenant do usuário
  const { data: member } = await db
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!member) return res.status(403).json({ error: 'Sem tenant vinculado' })

  // Buscar o bot e confirmar que pertence ao tenant do usuário
  const { data: bot, error: botErr } = await db
    .from('bots')
    .select('*')
    .eq('id', bot_id)
    .eq('tenant_id', member.tenant_id)
    .maybeSingle()

  if (botErr || !bot) return res.status(404).json({ error: 'Bot não encontrado ou sem permissão' })

  const results = { steps: [] }

  // 1. Deregister na Meta (se tiver phone_number_id)
  if (bot.phone_number_id) {
    const metaToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
    if (metaToken) {
      try {
        const metaResp = await fetch(`https://graph.facebook.com/v25.0/${bot.phone_number_id}/deregister`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${metaToken}` },
        })
        const metaData = await metaResp.json()
        results.steps.push({ step: 'meta_deregister', success: metaData.success !== false, result: metaData })
      } catch (e) {
        results.steps.push({ step: 'meta_deregister', error: e.message })
      }
    } else {
      results.steps.push({ step: 'meta_deregister', skipped: 'Token não configurado' })
    }
  }

  // 2. Limpar dados do WhatsApp no bot (mas não deletar o bot)
  const { error: updateErr } = await db
    .from('bots')
    .update({
      status: 'inactive',
      phone_number_id: null,
      waba_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bot_id)

  results.steps.push({ step: 'update_bot', success: !updateErr, error: updateErr?.message })

  // 3. Fechar conversas abertas (marcar como encerradas, não deletar)
  const { error: convErr } = await db
    .from('conversations')
    .update({ status: 'closed' })
    .eq('bot_id', bot_id)
    .in('status', ['open', 'bot', 'human'])

  results.steps.push({ step: 'close_conversations', success: !convErr, error: convErr?.message })

  return res.status(200).json({
    ok: true,
    message: 'WhatsApp desconectado com sucesso. Seu número foi liberado da plataforma.',
    bot_name: bot.name,
    results,
  })
}
