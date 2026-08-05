/**
 * POST /api/products/sync-catalog
 * Sincroniza um produto do painel com o catálogo oficial do WhatsApp (Meta Commerce API).
 * Chamado automaticamente ao criar/editar/pausar/apagar um produto na aba Produtos.
 * Body: { productId, tenantId, action: 'upsert' | 'remove' }
 */
import { createClient } from '@supabase/supabase-js'
import { upsertCatalogProduct, removeCatalogProduct } from '../../../lib/metaCatalog'

function getDB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { productId, tenantId, action } = req.body || {}

  if (!tenantId || !action) {
    return res.status(400).json({ error: 'tenantId e action são obrigatórios' })
  }

  // Se o catálogo não está configurado, não falha — só pula
  if (!process.env.ARKIEL_META_CATALOG_ID) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'catalogo_nao_configurado' })
  }

  const db = getDB()

  try {
    // ── Remover produto do catálogo ──
    if (action === 'remove') {
      // Busca o produto antes de remover pra ter os dados
      const { data: product } = await db.from('products')
        .select('*').eq('id', productId).single()

      const result = await removeCatalogProduct(product || { id: productId }, tenantId)

      await db.from('products').update({
        meta_sync_status: 'removed',
        meta_sync_error: null,
      }).eq('id', productId)

      return res.status(200).json({ ok: true, result })
    }

    // ── Upsert (criar ou atualizar) ──
    const { data: product, error } = await db.from('products')
      .select('*').eq('id', productId).eq('tenant_id', tenantId).single()

    if (error || !product) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    const result = await upsertCatalogProduct(product, tenantId)

    await db.from('products').update({
      meta_retailer_id: result.retailerId,
      meta_sync_status: result.ok ? 'synced' : 'error',
      meta_sync_error: result.ok ? null : result.error,
    }).eq('id', productId)

    return res.status(200).json({ ok: true, result })
  } catch (err) {
    console.error('[sync-catalog] Erro:', err)
    return res.status(500).json({ error: err.message })
  }
}
