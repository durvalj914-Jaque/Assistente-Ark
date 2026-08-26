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

  // Buscar conversa
  const { data: conv } = await db.from('conversations')
    .select('id, tenant_id, bot_id, contact_id')
    .eq('id', conversationId).maybeSingle()
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // ── 1. Buscar TODOS os pagamentos do tenant ──
  const { data: allPayments } = await db.from('payments')
    .select('id, amount, description, method, status, pix_code, pix_qr_url, paid_at, created_at, category')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).limit(500)

  // Filtrar por conversation_id OU contact_id no JSON
  const seenIds = new Set()
  const matchPayment = (p) => {
    if (seenIds.has(p.id)) return false
    try {
      const meta = JSON.parse(p.pix_qr_url || '{}')
      if (meta.conversation_id === conversationId) { seenIds.add(p.id); return true }
      if (conv.contact_id && meta.contact_id === conv.contact_id) { seenIds.add(p.id); return true }
    } catch { /* ignore */ }
    return false
  }

  let pending = (allPayments || []).filter(p => p.status === 'pending' && matchPayment(p))
  let paid = (allPayments || []).filter(p => (p.status === 'paid' || p.status === 'confirmed') && matchPayment(p))

  // ── 2. Buscar receipts desta conversa E contato (tem colunas diretas) ──
  let { data: receipts } = await db.from('payment_receipts')
    .select('id, payment_id, file_url, file_type, file_name, uploaded_by, notes, created_at, category, metadata, conversation_id, contact_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(100)

  if (conv.contact_id) {
    const { data: contactReceipts } = await db.from('payment_receipts')
      .select('id, payment_id, file_url, file_type, file_name, uploaded_by, notes, created_at, category, metadata, conversation_id, contact_id')
      .eq('contact_id', conv.contact_id)
      .order('created_at', { ascending: false }).limit(100)

    if (contactReceipts && contactReceipts.length > 0) {
      const existingIds = new Set((receipts || []).map(r => r.id))
      const merged = [...(receipts || [])]
      for (const r of contactReceipts) {
        if (!existingIds.has(r.id)) { existingIds.add(r.id); merged.push(r) }
      }
      receipts = merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  }

  // ── 3. Cruzar receipts com payments: se um receipt tem payment_id, garantir que o pagamento esteja em "paid" ──
  if (receipts && receipts.length > 0) {
    for (const r of receipts) {
      if (!r.payment_id) continue
      // Verificar se já está na lista de paid
      const alreadyPaid = paid.find(p => p.id === r.payment_id)
      if (alreadyPaid) continue

      // Buscar o pagamento completo
      const { data: pay } = await db.from('payments')
        .select('id, amount, description, method, status, pix_code, pix_qr_url, paid_at, created_at, category')
        .eq('id', r.payment_id).maybeSingle()

      if (pay && pay.status !== 'cancelled' && pay.status !== 'expired') {
        // Mesmo que o status não seja 'paid', se tem receipt, foi pago
        if (!seenIds.has(pay.id)) {
          seenIds.add(pay.id)
          paid.unshift({
            ...pay,
            status: 'paid',
            paid_at: pay.paid_at || r.created_at,
          })
        }
      }
    }
  }

  // ── 4. Buscar mensagens __pending_charge__ (cobranças antigas que não estão na tabela payments) ──
  const { data: pendingMsgs } = await db.from('messages')
    .select('id, content, created_at, type')
    .eq('conversation_id', conversationId)
    .eq('type', 'payment_pending')
    .order('created_at', { ascending: false }).limit(50)

  if (pendingMsgs && pendingMsgs.length > 0) {
    for (const msg of pendingMsgs) {
      const match = msg.content?.match(/amount=([\d.]+):desc=(.*?):pix=(.*?):method=(.*)/)
      if (!match) continue
      const [, amount, desc, pix, method] = match
      const pixCode = decodeURIComponent(pix)

      // Verificar se já existe um payment com este pix_code
      const alreadyExists = (allPayments || []).some(p => p.pix_code === pixCode || (p.pix_qr_url || '').includes(pixCode))
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

  // Ordenar por data
  pending.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  paid.sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))

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
