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

  // Buscar todos os pagamentos do tenant
  const { data: allPayments } = await db.from('payments')
    .select('id, amount, description, method, status, pix_code, pix_qr_url, paid_at, created_at, category')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }).limit(500)

  // Filtrar pagamentos desta conversa por conversation_id OU contact_id no JSON
  const convPayments = (allPayments || []).filter(p => {
    try {
      const meta = JSON.parse(p.pix_qr_url || '{}')
      // Match por conversation_id (pagamentos novos do create.js)
      if (meta.conversation_id === conversationId) return true
      // Match por contact_id (pagamentos do webhook, catálogo, avulsos)
      if (conv.contact_id && meta.contact_id === conv.contact_id) return true
      // Match por contact_id direto (se a coluna existir no futuro)
      if (conv.contact_id && p.contact_id === conv.contact_id) return true
    } catch { return false }
    return false
  })

  // Deduplicar por id (caso ambos os critérios peguem o mesmo pagamento)
  const seen = new Set()
  const dedupedPayments = convPayments.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  const pending = dedupedPayments.filter(p => p.status === 'pending')
  const paid = dedupedPayments.filter(p => p.status === 'paid')

  // Buscar comprovantes da conversa E do contato
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
