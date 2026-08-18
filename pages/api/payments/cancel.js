/**
 * POST /api/payments/cancel
 * Cancela um pagamento pendente.
 * Body: { payment_id, message_id } — payment_id para registros da tabela payments,
 *       message_id para cobranças antigas (apenas mensagem __pending_charge__)
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const { payment_id, message_id } = req.body
  if (!payment_id && !message_id) return res.status(400).json({ error: 'payment_id ou message_id é obrigatório' })

  const db = supabaseAdmin()

  // Resolver tenant do usuário
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Sem permissão' })
  const tenantId = member.tenant_id

  // Se for um registro da tabela payments
  if (payment_id && !payment_id.startsWith('msg_')) {
    const { data: payment, error } = await db.from('payments')
      .select('id, status, tenant_id')
      .eq('id', payment_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error || !payment) return res.status(404).json({ error: 'Pagamento não encontrado' })
    if (payment.status !== 'pending') return res.status(400).json({ error: 'Apenas pagamentos pendentes podem ser cancelados' })

    const { error: updErr } = await db.from('payments')
      .update({ status: 'cancelled' })
      .eq('id', payment_id)

    if (updErr) return res.status(500).json({ error: updErr.message })

    // Se for PIX via MP, tentar cancelar no Mercado Pago também
    try {
      const { data: fullPay } = await db.from('payments')
        .select('pix_qr_url').eq('id', payment_id).maybeSingle()

      if (fullPay?.pix_qr_url) {
        const meta = JSON.parse(fullPay.pix_qr_url || '{}')
        if (meta.mp_payment_id) {
          let mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
          if (mpToken) {
            await fetch(`https://api.mercadopago.com/v1/payments/${meta.mp_payment_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
              body: JSON.stringify({ status: 'cancelled' })
            })
          }
        }
      }
    } catch (mpErr) {
      console.error('[payments/cancel] Erro ao cancelar no MP:', mpErr.message)
    }

    return res.status(200).json({ ok: true, message: 'Pagamento cancelado' })
  }

  // Se for uma mensagem antiga (__pending_charge__)
  const realMsgId = message_id || (payment_id?.startsWith('msg_') ? payment_id.replace('msg_', '') : null)
  if (realMsgId) {
    const { error: delErr } = await db.from('messages')
      .delete()
      .eq('id', realMsgId)

    if (delErr) return res.status(500).json({ error: delErr.message })

    return res.status(200).json({ ok: true, message: 'Cobrança cancelada' })
  }

  return res.status(400).json({ error: 'Não foi possível identificar a cobrança' })
}
