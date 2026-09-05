/**
 * GET  /api/payments/receipts  — Lista comprovantes
 * POST /api/payments/receipts  — Cria comprovante manual
 * DELETE /api/payments/receipts?id=xxx — Remove comprovante
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // ── Auto-heal: comprovantes faltantes de compras de créditos pagas ──
    try {
      const { data: paidPurchases } = await db.from('credit_purchases')
        .select('id, tenant_id, credit_type, quantity, total_price_brl, payment_id')
        .eq('status', 'paid').not('payment_id', 'is', null)
      if (paidPurchases?.length) {
        const paymentIds = paidPurchases.map(p => p.payment_id)
        const { data: existing } = await db.from('payment_receipts')
          .select('payment_id').in('payment_id', paymentIds)
        const have = new Set((existing || []).map(r => r.payment_id))
        const missing = paidPurchases.filter(p => !have.has(p.payment_id))
        if (missing.length) {
          await db.from('payment_receipts').insert(missing.map(p => ({
            payment_id: p.payment_id,
            tenant_id: p.tenant_id,
            file_url: null,
            file_type: 'mp_confirmation',
            file_name: `MP · ${p.quantity} créditos`,
            uploaded_by: 'mercadopago',
            notes: `Compra de créditos confirmada via Mercado Pago — R$ ${parseFloat(p.total_price_brl).toFixed(2)} (pix) · ${p.quantity}x ${p.credit_type === 'marketing' ? 'marketing' : 'mensagens iniciais'}`,
            category: 'credit_purchase',
          })))
          console.log('[receipts] Auto-heal:', missing.length, 'comprovante(s) de créditos criado(s)')
        }
      }
    } catch (e) {
      console.error('[receipts] Erro no auto-heal de comprovantes:', e.message)
    }

    const { data, error } = await db.from('payment_receipts')
      .select('*, payments(amount, description, status, method)')
      .order('created_at', { ascending: false }).limit(200)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ receipts: data || [] })

  } else if (req.method === 'POST') {
    const { payment_id, conversation_id, contact_id, file_url, file_type, file_name, notes } = req.body
    if (!file_url) return res.status(400).json({ error: 'file_url é obrigatório' })

    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    const tenantId = member?.tenant_id || null

    const { data, error } = await db.from('payment_receipts').insert({
      payment_id: payment_id || null, tenant_id: tenantId, conversation_id: conversation_id || null,
      contact_id: contact_id || null, file_url, file_type: file_type || 'image',
      file_name: file_name || 'comprovante', uploaded_by: user.email || 'user', notes: notes || '',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    if (payment_id) {
      // Atualizar status e guardar receipt_id no pix_qr_url JSON
      const { data: pay } = await db.from('payments').select('pix_qr_url').eq('id', payment_id).maybeSingle()
      let existingMeta = {}
      try { existingMeta = JSON.parse(pay?.pix_qr_url || '{}') } catch {}
      await db.from('payments').update({
        status: 'paid', paid_at: new Date().toISOString(),
        pix_qr_url: JSON.stringify({ ...existingMeta, receipt_id: data.id, manual_confirmation: true })
      }).eq('id', payment_id)
    }

    return res.status(200).json({ ok: true, receipt: data })

  } else if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obrigatório' })
    const { error } = await db.from('payment_receipts').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
