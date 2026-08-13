import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member) return res.status(200).json({ payments: [] })

  const { data: orders, error } = await db.from('whatsapp_orders')
    .select('id, total, status, note, created_at')
    .eq('tenant_id', member.tenant_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })

  const payments = (orders || []).map(o => ({
    id: o.id,
    amount: o.total,
    status: o.status === 'paid' ? 'paid' : o.status === 'pending_payment' ? 'pending' : o.status === 'payment_failed' ? 'failed' : 'pending',
    description: `Pedido ${o.id.substring(0, 8)}`,
    created_at: o.created_at
  }))

  return res.status(200).json({ payments })
}
