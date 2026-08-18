/**
 * GET /api/payments/conv-charges?conversation_id=xxx
 * Retorna cobranças pendentes, pagas e comprovantes de uma conversa específica.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const conversationId = req.query.conversation_id
  if (!conversationId) return res.status(400).json({ error: 'conversation_id é obrigatório' })

  const db = supabaseAdmin()

  // Resolver tenant do usuário
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Sem permissão' })
  const tenantId = member.tenant_id

  // Buscar conversa para obter bot_id e contact_id
  const { data: conv } = await db.from('conversations')
    .select('id, tenant_id, bot_id, contact_id')
    .eq('id', conversationId).maybeSingle()
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // 1. Buscar pagamentos na tabela payments
  const { data: allPayments } = await db.from('payments')
    .select('id, amount, description, method, status, pix_code, pix_qr_url, paid_at, created_at, category')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).limit(500)

  // Filtrar pagamentos desta conversa por conversation_id OU contact_id no JSON
  const convPayments = (allPayments || []).filter(p => {
    try {
      const meta = JSON.parse(p.pix_qr_url || '{}')
      if (meta.conversation_id === conversationId) return true
      if (conv.contact_id && meta.contact_id === conv.contact_id) return true
    } catch { return false }
    return false
  })

  // Deduplicar por id
  const seenIds = new Set()
  const dedupedPayments = convPayments.filter(p => {
    if (seenIds.has(p.id)) return false
    seenIds.add(p.id)
    return true
  })

  let pending = dedupedPayments.filter(p => p.status === 'pending')
  let paid = dedupedPayments.filter(p => p.status === 'paid')

  // 2. Buscar mensagens __pending_charge__ (cobranças antigas que não foram salvas na tabela payments)
  const { data: pendingMsgs } = await db.from('messages')
    .select('id, content, created_at, type')
    .eq('conversation_id', conversationId)
    .eq('type', 'payment_pending')
    .order('created_at', { ascending: false }).limit(50)

  // Converter mensagens pending em objetos de pagamento (se ainda não estão na tabela payments)
  if (pendingMsgs && pendingMsgs.length > 0) {
    for (const msg of pendingMsgs) {
      // Parse: __pending_charge__:amount=XX:desc=XX:pix=XX:method=XX
      const match = msg.content?.match(/amount=([^:]+):desc=([^:]*):pix=([^:]*):method=(.*)/)
      if (!match) continue

      const [, amount, desc, pix, method] = match
      const pixCode = decodeURIComponent(pix)

      // Verificar se já existe um payment com este pix_code
      const alreadyExists = dedupedPayments.some(p => p.pix_code === pixCode || p.pix_qr_url?.includes(pixCode))
      if (alreadyExists) continue

      pending.push({
        id: 'msg_' + msg.id,
        amount: parseFloat(amount),
        description: decodeURIComponent(desc),
        method: method || 'PIX',
        status: 'pending',
        pix_code: pixCode,
        pix_qr_url: JSON.stringify({ from_message: true, message_id: msg.id }),
        paid_at: null,
        created_at: msg.created_at,
        category: 'b2c_charge',
      })
    }
  }

  // 3. Buscar comprovantes
  let { data: receipts } = await db.from('payment_receipts')
    .select('id, payment_id, file_url, file_type, file_name, uploaded_by, notes, created_at, category, metadata')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(100)

  if (conv.contact_id) {
    const { data: contactReceipts } = await db.from('payment_receipts')
      .select('id, payment_id, file_url, file_type, file_name, uploaded_by, notes, created_at, category, metadata')
      .eq('contact_id', conv.contact_id)
      .order('created_at', { ascending: false }).limit(100)

    if (contactReceipts && contactReceipts.length > 0) {
      const existingIds = new Set((receipts || []).map(r => r.id))
      const merged = [...(receipts || [])]
      for (const r of contactReceipts) {
        if (!existingIds.has(r.id)) {
          existingIds.add(r.id)
          merged.push(r)
        }
      }
      receipts = merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  }

  return res.status(200).json({
    pending,
    paid,
    receipts: receipts || [],
    summary: {
      pending_count: pending.length,
      pending_total: pending.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
      paid_count: paid.length,
      paid_total: paid.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
      receipts_count: (receipts || []).length,
    }
  })
}
