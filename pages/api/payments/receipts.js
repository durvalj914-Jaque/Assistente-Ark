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
    const { data, error } = await db.from('payment_receipts')
      .select('*, payments(amount, description, status, method)')
      .order('created_at', { ascending: false }).limit(200)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ receipts: data || [] })

  } else if (req.method === 'POST') {
    const { payment_id, conversation_id, contact_id, file_url, file_type, file_name, notes } = req.body
    if (!file_url) return res.status(400).json({ error: 'file_url é obrigatório' })

    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
    const tenantId = member?.tenant_id || null

    const { data, error } = await db.from('payment_receipts').insert({
      payment_id: payment_id || null, tenant_id: tenantId, conversation_id: conversation_id || null,
      contact_id: contact_id || null, file_url, file_type: file_type || 'image',
      file_name: file_name || 'comprovante', uploaded_by: user.email || 'user', notes: notes || '',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    if (payment_id) {
      await db.from('payments').update({
        status: 'paid', paid_at: new Date().toISOString(),
        metadata: { receipt_id: data.id, manual_confirmation: true }
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
