/**
 * /api/whatsapp/showcase — vitrine oficial do número (catálogo + perfil).
 *
 * GET  ?tenant_id=...  → status da vitrine: catálogo conectado, quantos
 *                        produtos subiram, se o catálogo aparece no perfil
 *                        e o que falta no perfil do WhatsApp.
 * POST { tenant_id }   → reaplica a vitrine agora (perfil, catálogo e
 *                        produtos). Mesma rotina que roda na conexão.
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant } from '../../../lib/serverAuth'
import { resolveCatalogId, catalogTenantIds, ensureShowcase } from '../../../lib/showcase'

const GRAPH = 'https://graph.facebook.com/v25.0'

export default async function handler(req, res) {
  const auth = await requireTenant(req, res)
  if (!auth) return

  const db = supabaseAdmin()
  const tenantId = auth.tenant_id

  const { data: bot } = await db.from('bots')
    .select('id, name, phone_number_id, status, access_token')
    .eq('tenant_id', tenantId)
    .not('phone_number_id', 'is', null)
    .order('status', { ascending: true })
    .limit(1)
    .maybeSingle()

  const token = bot?.access_token || process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2

  if (req.method === 'POST') {
    if (!bot) return res.status(400).json({ error: 'Conecte um número de WhatsApp primeiro.' })
    const result = await ensureShowcase({ db, tenantId, phoneNumberId: bot.phone_number_id, token })
    return res.status(200).json(result)
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // ── Status ──
  const { data: products } = await db.from('products')
    .select('id, name, is_active, meta_sync_status, meta_sync_error')
    .eq('tenant_id', tenantId)

  const counts = { total: 0, active: 0, synced: 0, local_only: 0, error: 0, pending: 0 }
  for (const p of products || []) {
    counts.total++
    if (p.is_active) counts.active++
    const st = p.meta_sync_status || 'pending'
    if (counts[st] !== undefined) counts[st]++
  }

  let catalog = null
  let tenantsInCatalog = null
  let catalogReview = null
  let catalogVisible = null
  let profile = null
  let profileIssues = []
  let error = null

  try {
    if (token) {
      catalog = await resolveCatalogId(token, { create: false })
      if (catalog?.id) {
        const tenants = await catalogTenantIds(catalog.id, token)
        tenantsInCatalog = tenants.size
        // Situação de cada produto na revisão da Meta: é ela que decide quando
        // o item (e portanto a vitrine) passa a aparecer pro cliente final.
        let after = null
        const review = { approved: 0, pending: 0, rejected: 0, other: 0 }
        for (let page = 0; page < 10; page++) {
          const q = `fields=retailer_id,review_status,visibility&limit=200${after ? `&after=${after}` : ''}`
          const pr = await fetch(`${GRAPH}/${catalog.id}/products?${q}&access_token=${token}`)
          const pd = await pr.json()
          for (const item of pd?.data || []) {
            const st = String(item?.review_status || '').toUpperCase()
            if (st === 'APPROVED') review.approved++
            else if (st === 'REJECTED' || st === 'OUTDATED') review.rejected++
            else if (!st || st === 'PENDING') review.pending++
            else review.other++
          }
          after = pd?.paging?.next ? pd?.paging?.cursors?.after : null
          if (!after) break
        }
        catalogReview = review
      }
      if (bot?.phone_number_id) {
        const r = await fetch(`${GRAPH}/${bot.phone_number_id}/whatsapp_commerce_settings?fields=is_catalog_visible,is_cart_enabled&access_token=${token}`)
        const d = await r.json()
        const s = d?.data?.[0] || {}
        catalogVisible = typeof s.is_catalog_visible === 'boolean' ? s.is_catalog_visible : null
        const pr = await fetch(`${GRAPH}/${bot.phone_number_id}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical&access_token=${token}`)
        const pd = await pr.json()
        profile = pd?.data?.[0] || null
        if (profile) {
          if (!profile.about) profileIssues.push('Frase de apresentação')
          if (!profile.description) profileIssues.push('Descrição')
          if (!(profile.websites || []).filter(Boolean).length) profileIssues.push('Site')
          if (!profile.vertical) profileIssues.push('Categoria')
          if (!profile.profile_picture_url) profileIssues.push('Foto de perfil')
        }
      }
    }
  } catch (err) {
    error = err.message
  }

  return res.status(200).json({
    ok: true,
    connected: !!bot?.phone_number_id,
    bot: bot ? { id: bot.id, name: bot.name, phone_number_id: bot.phone_number_id } : null,
    catalog: catalog?.id ? { id: catalog.id, source: catalog.source } : null,
    catalog_visible_on_profile: catalogVisible,
    catalog_review: catalogReview,
    tenants_in_catalog: tenantsInCatalog,
    shared_catalog: tenantsInCatalog !== null ? tenantsInCatalog > 1 : null,
    products: counts,
    profile,
    profile_issues: profileIssues,
    error,
  })
}
