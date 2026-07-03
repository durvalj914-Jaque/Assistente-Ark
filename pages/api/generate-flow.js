/**
 * POST /api/generate-flow
 * Gera um fluxo de atendimento completo a partir de uma descrição em texto livre, usando IA (OpenAI).
 * Body: { bot_id, description }
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * Retorna { flow } pro editor carregar em tela — não grava direto no bot (o usuário
 * revisa e clica em "Salvar fluxo" quando quiser confirmar).
 */
import { supabaseAdmin } from '../../lib/supabase'
import { generateFlowFromDescription } from '../../lib/ai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bot_id, description } = req.body || {}
  if (!bot_id || !description?.trim()) {
    return res.status(400).json({ error: 'bot_id e description são obrigatórios' })
  }
  if (description.length > 1500) {
    return res.status(400).json({ error: 'Descrição muito longa (máximo 1500 caracteres)' })
  }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: bot, error: botErr } = await db
    .from('bots').select('id, tenant_id').eq('id', bot_id).single()
  if (botErr || !bot) return res.status(404).json({ error: 'Bot não encontrado' })

  const { data: member } = await db
    .from('tenant_members').select('role')
    .eq('tenant_id', bot.tenant_id).eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a este bot' })

  try {
    const flow = await generateFlowFromDescription(description.trim())
    return res.status(200).json({ flow })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro ao gerar fluxo com IA' })
  }
}
