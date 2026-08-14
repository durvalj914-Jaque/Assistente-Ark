/**
 * POST /api/push/test
 * Manda uma notificação de teste pro próprio tenant do usuário logado.
 * Body opcional: { type: 'human_handoff' | 'no_bot_message' | ... }
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { sendPushToTenant } from '../../../lib/webpush'
import { sendFcmToTenant } from '../../../lib/fcm'

const TEST_PAYLOADS = {
  human_handoff: { title: '👤 Cliente pediu atendimento humano', body: 'Teste: cliente pediu atendimento humano', icon: '👤' },
  no_bot_message: { title: '🔇 Mensagem de "Sem bot"', body: 'Teste: fornecedor/familiar enviou mensagem', icon: '🔇' },
  new_order: { title: '🛒 Novo pedido recebido!', body: 'Teste: novo pedido no carrinho', icon: '🛒' },
  receipt: { title: '📄 Comprovante recebido', body: 'Teste: comprovante de pagamento', icon: '📄' },
  loop_detected: { title: '⏸️ Loop detectado — bot pausado', body: 'Teste: bot pausado por excesso de mensagens', icon: '⏸️' },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: member } = await db
    .from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Usuário sem tenant' })

  const type = (req.body?.type) || 'human_handoff'
  const payload = TEST_PAYLOADS[type] || TEST_PAYLOADS.human_handoff

  await Promise.all([
    sendPushToTenant(member.tenant_id, { ...payload, type, url: '/admin/conversations', tag: `ark-test-${type}-${Date.now()}` }),
    sendFcmToTenant(member.tenant_id, { ...payload, type, url: '/admin/conversations', tag: `ark-test-${type}-${Date.now()}` }),
  ])

  return res.status(200).json({ ok: true, type })
}
