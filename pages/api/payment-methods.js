/**
 * GET    /api/payment-methods          — Lista métodos (?type=payment|billing)
 * POST   /api/payment-methods          — Cria método
 * PATCH  /api/payment-methods          — Atualiza método { id, ...updates }
 * DELETE /api/payment-methods?id=xxx   — Remove método
 */
import { supabase, supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Buscar tenant_id do usuário
  const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  const tenantId = member?.tenant_id

  if (req.method === 'GET') {
    let query = db.from('payment_methods').select('*').order('created_date', { ascending: false })
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { type } = req.query
    if (type) query = query.eq('type', type)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ methods: data || [] })

  } else if (req.method === 'POST') {
    const { type, method_name, method_key, is_active, metadata } = req.body
    if (!method_name) return res.status(400).json({ error: 'method_name é obrigatório' })

    const { data, error } = await db.from('payment_methods').insert({
      tenant_id: tenantId, user_id: user.id,
      type: type || 'payment',
      method_name,
      method_key: method_key || null,
      is_active: is_active !== false,
      metadata: metadata || {},
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, method: data })

  } else if (req.method === 'PATCH') {
    const { id, method_name, method_key, is_active, metadata } = req.body
    if (!id) return res.status(400).json({ error: 'id é obrigatório' })

    const updates = {}
    if (method_name !== undefined) updates.method_name = method_name
    if (method_key !== undefined) updates.method_key = method_key
    if (is_active !== undefined) updates.is_active = is_active
    if (metadata !== undefined) updates.metadata = metadata
    updates.updated_date = new Date().toISOString()

    const { error } = await db.from('payment_methods').update(updates).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })

  } else if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id é obrigatório' })
    const { error } = await db.from('payment_methods').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
