/**
 * POST /api/admin/resync-catalog
 * Backfill: sincroniza TODOS os produtos ativos de TODOS os tenants com o
 * catálogo Meta. Útil pra produtos criados antes da integração existir ou
 * que falharam silenciosamente na sincronização automática.
 * Protegido por secret (mesma convenção dos outros endpoints /api/admin/*).
 */
import { createClient } from '@supabase/supabase-js'
import { upsertCatalogProduct } from '../../../lib/metaCatalog'

const SETUP_SECRET = process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025'

function getDB() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  const secret = req.headers['x-setup-secret'] || req.query.secret
  if (secret !== SETUP_SECRET) return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ARKIEL_META_CATALOG_ID) {
    return res.status(200).json({ ok: false, reason: 'catalogo_nao_configurado' })
  }

  const db = getDB()

  // ── GUARDA DE ISOLAMENTO ──
  // O catálogo Meta é compartilhado pela WABA: só sincroniza produtos de
  // tenants com WhatsApp conectado (bot ativo com phone_number_id).
  const { data: connectedTenants, error: tErr } = await db.from('bots')
    .select('tenant_id')
    .eq('status', 'active')
    .not('phone_number_id', 'is', null)
  if (tErr) return res.status(500).json({ error: tErr.message })
  const allowed = new Set((connectedTenants || []).map(b => b.tenant_id))

  const { data: products, error } = await db.from('products').select('*').eq('is_active', true)
  if (error) return res.status(500).json({ error: error.message })

  const results = []
  let skipped = 0
  for (const product of products || []) {
    if (!allowed.has(product.tenant_id)) {
      skipped++
      await db.from('products').update({
        meta_sync_status: 'local_only',
        meta_sync_error: null,
      }).eq('id', product.id)
      continue
    }
    const result = await upsertCatalogProduct(product, product.tenant_id)
    await db.from('products').update({
      meta_retailer_id: result.retailerId,
      meta_sync_status: result.ok ? 'synced' : 'error',
      meta_sync_error: result.ok ? null : result.error,
    }).eq('id', product.id)
    results.push({ id: product.id, name: product.name, ok: result.ok, error: result.error })
  }

  return res.status(200).json({ ok: true, total: results.length, skipped_sem_whatsapp: skipped, results })
}
