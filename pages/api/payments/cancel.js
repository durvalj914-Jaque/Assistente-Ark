/**
 * POST /api/payments/cancel
 * Cancela um pagamento pendente.
 * Se o pagamento foi criado via Mercado Pago (tem mp_payment_id), cancela também no MP.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { payment_id } = req.body
  if (!payment_id) return res.status(400).json({ error: 'payment_id é obrigatório' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Buscar perfil e tenant do usuário
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  let tenantId = null
  if (!profile?.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
    tenantId = member.tenant_id
  }

  // Buscar o pagamento
  let query = db.from('payments').select('*').eq('id', payment_id)
  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data: payment, error: payErr } = await query.maybeSingle()
  if (payErr) return res.status(500).json({ error: payErr.message })
  if (!payment) return res.status(404).json({ error: 'Pagamento não encontrado' })

  // Só permite cancelar pagamentos pendentes
  if (payment.status !== 'pending') {
    return res.status(400).json({ error: `Pagamento não pode ser cancelado (status: ${payment.status})` })
  }

  // Se tem mp_payment_id, tentar cancelar no Mercado Pago
  let mpMeta = {}
  try { mpMeta = JSON.parse(payment.pix_qr_url || '{}') } catch {}

  if (mpMeta.mp_payment_id) {
    let mpToken = null
    const { data: tenant } = await db.from('tenants').select('mp_access_token').eq('id', payment.tenant_id).maybeSingle()
    if (tenant?.mp_access_token) {
      try { mpToken = JSON.parse(tenant.mp_access_token).access_token } catch { mpToken = tenant.mp_access_token }
    }
    if (!mpToken) mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2

    if (mpToken) {
      try {
        const mpCancelRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpMeta.mp_payment_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
          body: JSON.stringify({ status: 'cancelled' })
        })
        const mpCancelData = await mpCancelRes.json()
        if (!mpCancelRes.ok) {
          console.error('[cancel] MP cancel failed:', JSON.stringify(mpCancelData).substring(0, 200))
        }
        mpMeta.mp_cancel_status = mpCancelData.status
        mpMeta.mp_cancelled_at = new Date().toISOString()
      } catch (e) {
        console.error('[cancel] MP cancel error:', e.message)
      }
    }
  }

  // Atualizar o pagamento no banco
  const { error: updateErr } = await db.from('payments')
    .update({
      status: 'cancelled',
      pix_qr_url: JSON.stringify({ ...mpMeta, cancelled_at: new Date().toISOString(), cancelled_by: user.id })
    })
    .eq('id', payment_id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({
    ok: true,
    payment_id,
    status: 'cancelled',
    mp_cancelled: !!mpMeta.mp_cancel_status
  })
}
