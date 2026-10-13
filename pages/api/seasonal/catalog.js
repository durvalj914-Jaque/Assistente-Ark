/**
 * /api/seasonal/catalog
 * GET  → catálogo de fluxos sazonais (data comemorativa) + assinaturas do tenant
 * POST → { action: 'acquire' | 'toggle', bot_id, seasonal_flow_id }
 *         acquire: cria a assinatura do fluxo para o bot (1 clique, ativa na janela de datas)
 *         toggle:  liga/desliga uma assinatura existente
 */
import { createClient } from '@supabase/supabase-js'
import { requireTenant } from '../../../lib/serverAuth'

function getDB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const auth = await requireTenant(req, res)
  if (!auth) return
  if (req.body) req.body.tenantId = auth.tenant_id
  const db = getDB()

  if (req.method === 'GET') {
    const { data: catalog, error: catErr } = await db.from('seasonal_flows')
      .select('id,name,emoji,description,start_md,end_md,price,is_active')
      .eq('is_active', true)
      .order('start_md')
    const { data: subs } = await db.from('flow_subscriptions')
      .select('id,bot_id,seasonal_flow_id,status,purchased_at')
      .eq('tenant_id', auth.tenant_id)
    return res.json({ ok: true, catalog: catalog || [], subscriptions: subs || [] })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, bot_id, seasonal_flow_id, tenantId } = req.body || {}
  if (!bot_id || !seasonal_flow_id) return res.status(400).json({ error: 'bot_id e seasonal_flow_id são obrigatórios' })

  // O bot precisa pertencer ao tenant
  const { data: bot } = await db.from('bots').select('id').eq('id', bot_id).eq('tenant_id', tenantId).maybeSingle()
  if (!bot) return res.status(403).json({ error: 'Sem acesso a este bot' })

  if (action === 'acquire') {
    const { data: existing } = await db.from('flow_subscriptions')
      .select('id').eq('bot_id', bot_id).eq('seasonal_flow_id', seasonal_flow_id).maybeSingle()
    if (existing) return res.status(409).json({ error: 'Este bot já tem este fluxo' })
    const { error: insErr } = await db.from('flow_subscriptions').insert({
      tenant_id: tenantId, bot_id, seasonal_flow_id, status: 'active',
    })
    if (insErr) return res.status(500).json({ error: insErr.message })
    return res.json({ ok: true, status: 'active' })
  }

  if (action === 'toggle') {
    const { data: sub } = await db.from('flow_subscriptions')
      .select('id,status').eq('bot_id', bot_id).eq('seasonal_flow_id', seasonal_flow_id)
      .eq('tenant_id', tenantId).maybeSingle()
    if (!sub) return res.status(404).json({ error: 'Assinatura não encontrada' })
    const next = sub.status === 'active' ? 'inactive' : 'active'
    const { error: updErr } = await db.from('flow_subscriptions')
      .update({ status: next }).eq('id', sub.id)
    if (updErr) return res.status(500).json({ error: updErr.message })
    return res.json({ ok: true, status: next })
  }

  return res.status(400).json({ error: 'action inválida' })
}
