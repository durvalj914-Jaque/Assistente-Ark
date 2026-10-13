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

const MD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

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
      .select('id,bot_id,seasonal_flow_id,status,purchased_at,custom_start_md,custom_end_md,featured_product_ids')
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

  if (action === 'update') {
    const { custom_start_md, custom_end_md, featured_product_ids } = req.body || {}
    const patch = {}
    if (custom_start_md !== undefined) {
      if (custom_start_md && !MD_RE.test(custom_start_md)) return res.status(400).json({ error: 'start deve ser MM-DD (ex: 10-08)' })
      patch.custom_start_md = custom_start_md || null
    }
    if (custom_end_md !== undefined) {
      if (custom_end_md && !MD_RE.test(custom_end_md)) return res.status(400).json({ error: 'end deve ser MM-DD (ex: 10-13)' })
      patch.custom_end_md = custom_end_md || null
    }
    if (Array.isArray(featured_product_ids)) {
      const ids = featured_product_ids.filter(Boolean)
      if (ids.length) {
        const { data: owned } = await db.from('products').select('id').eq('tenant_id', tenantId).in('id', ids)
        if (owned?.length !== ids.length) return res.status(403).json({ error: 'Produto não pertence ao seu tenant' })
      }
      patch.featured_product_ids = ids
    }
    const { data: sub } = await db.from('flow_subscriptions')
      .select('id').eq('bot_id', bot_id).eq('seasonal_flow_id', seasonal_flow_id)
      .eq('tenant_id', tenantId).maybeSingle()
    if (!sub) return res.status(404).json({ error: 'Adesão não encontrada' })
    const { error: updErr } = await db.from('flow_subscriptions').update(patch).eq('id', sub.id)
    if (updErr) return res.status(500).json({ error: updErr.message })
    return res.json({ ok: true, updated: patch })
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
