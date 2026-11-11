/**
 * Vitrine oficial do WhatsApp — o número nasce pronto, igual ao WhatsApp Business App.
 *
 * No app do celular o número já vem "com cara de loja": perfil preenchido e
 * catálogo de produtos visível. Na Cloud API nada disso vem de fábrica — o
 * número nasce com perfil vazio, commerce settings desligado e os produtos
 * parados no painel. Este módulo fecha essa diferença no momento da conexão:
 *
 *   1. garante o catálogo da Arkiel conectado à WABA compartilhada;
 *   2. preenche o perfil do WhatsApp (about, descrição, site, categoria) sem
 *      sobrescrever nada que o cliente já tenha configurado;
 *   3. liga a vitrine no número (catálogo visível + carrinho);
 *   4. publica no catálogo Meta todos os produtos ativos do painel do tenant;
 *   5. o menu do bot nasce com a opção que abre esse catálogo.
 *
 * ISOLAMENTO ENTRE CLIENTES: a Meta permite UM catálogo por WABA e a Arkiel
 * compartilha a WABA entre todos os tenants. O catálogo dentro do chat é
 * sempre filtrado (product_list com os retailer_ids do próprio tenant), mas a
 * vitrine do PERFIL mostra o catálogo inteiro. Por isso a visibilidade no
 * perfil só é ligada quando o catálogo tem produtos de um único cliente; com
 * mais de um ela fica desligada, para nunca expor produto de outro cliente.
 */

import { upsertCatalogProduct } from './metaCatalog'

const GRAPH = 'https://graph.facebook.com/v25.0'
const DEFAULT_WABA = '1867398900635798'
const CATALOG_NAME = 'Arkiel - Catálogo Unificado'
const PUBLIC_SITE = 'https://www.assistente-ark.com.br'

function wabaId() {
  return process.env.ARKIEL_SHARED_WABA_ID || DEFAULT_WABA
}

async function withTimeout(promise, ms, label) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: tempo esgotado`)), ms) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function gget(path, params, token) {
  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  url.searchParams.set('access_token', token)
  const r = await withTimeout(fetch(url), 15000, 'graph-get')
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data?.error?.error_user_msg || data?.error?.message || `Graph ${r.status}`)
  return data
}

async function gpost(path, body, token) {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body || {})) {
    if (v === undefined || v === null) continue
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  }
  const r = await withTimeout(fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  }), 15000, 'graph-post')
  const data = await r.json().catch(() => ({}))
  if (!r.ok || data?.error) {
    throw new Error(data?.error?.error_user_msg || data?.error?.message || `Graph ${r.status}`)
  }
  return data
}

/** Catálogo da WABA compartilhada: usa o env, senão o que já está conectado, senão cria. */
export async function resolveCatalogId(token, { create = true } = {}) {
  if (process.env.ARKIEL_META_CATALOG_ID) {
    return { id: process.env.ARKIEL_META_CATALOG_ID, source: 'env' }
  }
  try {
    const list = await gget(`${wabaId()}/product_catalogs`, { fields: 'id,name', limit: 10 }, token)
    const found = (list?.data || []).find(c => c?.id)
    if (found) return { id: found.id, source: 'waba', name: found.name }
  } catch (_) { /* segue pro caminho de criação */ }

  if (!create) return { id: null, source: 'none' }

  const waba = await gget(wabaId(), { fields: 'owner_business_info' }, token)
  const businessId = waba?.owner_business_info?.id
  if (!businessId) throw new Error('Business Manager da WABA não encontrado')
  const created = await gpost(`${businessId}/owned_product_catalogs`, { name: CATALOG_NAME, vertical: 'commerce' }, token)
  if (!created?.id) throw new Error('A Meta não devolveu o id do catálogo criado')
  try {
    await gpost(`${wabaId()}/product_catalogs`, { catalog_id: created.id }, token)
  } catch (err) {
    if (!/already|existente/i.test(err.message || '')) throw err
  }
  return { id: created.id, source: 'created' }
}

/** Quais tenants têm produtos dentro do catálogo (retailer_id começa com t{tenant}). */
export async function catalogTenantIds(catalogId, token) {
  const tenants = new Set()
  let after = null
  for (let page = 0; page < 10; page++) {
    const data = await gget(`${catalogId}/products`, { fields: 'retailer_id', limit: 200, after }, token)
    for (const item of data?.data || []) {
      const m = /^t([0-9a-f]{32})_p/.exec(item?.retailer_id || '')
      if (m) {
        const h = m[1]
        tenants.add(`${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`)
      }
    }
    after = data?.paging?.next ? data?.paging?.cursors?.after : null
    if (!after) break
  }
  return tenants
}

/**
 * Publica no catálogo Meta os produtos ativos do tenant (upsert idempotente).
 * `limit` segura a conexão rápida quando a conta tem muitos itens: o restante
 * sobe pelo botão do painel ou pelas próximas edições de produto.
 */
export async function syncTenantProducts(db, tenantId, { limit } = {}) {
  let query = db.from('products').select('*').eq('tenant_id', tenantId).eq('is_active', true)
  if (limit) query = query.limit(limit)
  const { data: products, error } = await query
  if (error) throw new Error(error.message)

  // Quantos produtos ativos ficaram de fora dessa rodada (contas grandes).
  let pending = 0
  if (limit) {
    const { count } = await db.from('products')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('is_active', true)
    pending = Math.max(0, Number(count || 0) - (products || []).length)
  }

  let synced = 0
  let failed = 0
  const failures = []
  for (const product of products || []) {
    const result = await upsertCatalogProduct(product, tenantId)
    const status = result.ok ? 'synced' : (result.skipped ? 'local_only' : 'error')
    await db.from('products').update({
      meta_retailer_id: result.retailerId || null,
      meta_sync_status: status,
      meta_sync_error: result.ok ? null : (result.error || result.reason || null),
    }).eq('id', product.id)
    if (result.ok) synced++
    else { failed++; failures.push({ name: product.name, error: result.error || result.reason }) }
  }
  return { total: (products || []).length, synced, failed, pending, failures: failures.slice(0, 5) }
}

/** Preenche só o que está vazio no perfil do WhatsApp. Nunca sobrescreve o cliente. */
export async function ensureProfile({ phoneNumberId, token, tenant, tenantId, db }) {
  const current = (await gget(`${phoneNumberId}/whatsapp_business_profile`, {
    fields: 'about,address,description,email,profile_picture_url,websites,vertical',
  }, token))?.data?.[0] || {}

  const name = (tenant?.name || '').trim() || 'Atendimento'
  const showcaseUrl = `${PUBLIC_SITE}/catalog/${tenantId}`

  let tenantEmail = null
  if (db && !current.email) {
    try {
      const { data: member } = await db.from('tenant_members')
        .select('user_id').eq('tenant_id', tenantId).limit(1).maybeSingle()
      if (member?.user_id) {
        const { data: profile } = await db.from('profiles')
          .select('email').eq('id', member.user_id).maybeSingle()
        tenantEmail = profile?.email || null
      }
    } catch (_) { /* e-mail é opcional */ }
  }

  const patch = {}
  if (!current.about) patch.about = `${name} · atendimento no WhatsApp`.slice(0, 139)
  if (!current.description) {
    patch.description = `${name}: atendimento automático no WhatsApp com catálogo de produtos, agendamento e pagamento. Fale com a gente por aqui.`.slice(0, 512)
  }
  if (tenantEmail && !current.email) patch.email = tenantEmail
  if (!(current.websites || []).filter(Boolean).length) patch.websites = [showcaseUrl]
  if (!current.vertical) patch.vertical = 'OTHER'

  const missingPicture = !current.profile_picture_url
  if (!Object.keys(patch).length) {
    return { ok: true, updated: false, missing_picture: missingPicture, profile: current }
  }

  const body = { messaging_product: 'whatsapp', ...patch }
  // Reenvia o que já existe para o POST não zerar campos que não estamos mudando.
  if (current.about) body.about = current.about
  if (current.description) body.description = current.description
  if (current.email) body.email = current.email
  if ((current.websites || []).length) body.websites = current.websites
  if (current.vertical) body.vertical = current.vertical
  if (current.address) body.address = current.address

  await gpost(`${phoneNumberId}/whatsapp_business_profile`, body, token)
  return { ok: true, updated: true, fields: Object.keys(patch), missing_picture: missingPicture }
}

/** Liga/desliga a vitrine no número (catálogo visível no perfil + carrinho). */
export async function setCommerceSettings(phoneNumberId, token, { catalogVisible, cartEnabled = true }) {
  const body = {}
  if (typeof catalogVisible === 'boolean') body.is_catalog_visible = catalogVisible
  if (typeof cartEnabled === 'boolean') body.is_cart_enabled = cartEnabled
  await gpost(`${phoneNumberId}/whatsapp_commerce_settings`, body, token)
  return { ok: true }
}

/**
 * Mantém um estado coerente em TODOS os números conectados: vitrine do perfil
 * só fica visível enquanto o catálogo compartilhado tiver produtos de um único
 * cliente. Com dois ou mais, ninguém expõe catálogo de outro.
 */
export async function reconcileShowcaseVisibility({ db, token, catalogId }) {
  const tenantsInCatalog = await catalogTenantIds(catalogId, token)

  const { data: bots } = await db.from('bots')
    .select('id, tenant_id, phone_number_id, status')
    .not('phone_number_id', 'is', null)

  const numbers = []
  for (const bot of bots || []) {
    if (!bot.phone_number_id) continue
    // O catálogo no perfil mostra TODOS os itens do catálogo da WABA. Só pode
    // ficar visível quando todos os itens são do próprio tenant — assim nunca
    // aparece produto de outro cliente (nem o catálogo fica vazio).
    const visible = tenantsInCatalog.size === 1 && tenantsInCatalog.has(bot.tenant_id)
    try {
      await setCommerceSettings(bot.phone_number_id, token, { catalogVisible: visible, cartEnabled: true })
      numbers.push({ bot_id: bot.id, phone_number_id: bot.phone_number_id, catalog_visible: visible })
    } catch (err) {
      numbers.push({ bot_id: bot.id, phone_number_id: bot.phone_number_id, error: err.message })
    }
  }

  return {
    tenants_in_catalog: tenantsInCatalog.size,
    profile_catalog_visible: numbers.some(n => n.catalog_visible === true),
    numbers,
  }
}

/**
 * Roda a vitrine inteira para um tenant que acabou de conectar um número.
 * Nunca lança: cada etapa é independente e o que falhar volta em `warnings`
 * (conectar o número não pode quebrar por causa da vitrine).
 */
export async function ensureShowcase({ db, tenantId, phoneNumberId, token, productLimit }) {
  const accessToken = token || process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  const steps = {}
  const warnings = []
  if (!accessToken) return { ok: false, error: 'token_da_meta_indisponivel', steps, warnings }

  const { data: tenant } = await db.from('tenants').select('id,name').eq('id', tenantId).maybeSingle()

  let catalogId = null
  try {
    const catalog = await resolveCatalogId(accessToken)
    catalogId = catalog.id
    // upsertCatalogProduct lê o catálogo do ambiente; se o env não estiver
    // configurado, usa o que acabamos de descobrir na WABA.
    if (catalogId && !process.env.ARKIEL_META_CATALOG_ID) process.env.ARKIEL_META_CATALOG_ID = catalogId
    steps.catalog = catalog
  } catch (err) {
    warnings.push(`catálogo: ${err.message}`)
  }

  if (phoneNumberId) {
    try {
      steps.profile = await ensureProfile({ phoneNumberId, token: accessToken, tenant, tenantId, db })
    } catch (err) {
      warnings.push(`perfil: ${err.message}`)
    }
  }

  try {
    steps.products = await syncTenantProducts(db, tenantId, { limit: productLimit })
    if (steps.products.failed) warnings.push(`${steps.products.failed} produto(s) não subiram pro catálogo`)
    if (steps.products.pending) warnings.push(`${steps.products.pending} produto(s) entram no catálogo ao abrir a vitrine no painel`)
  } catch (err) {
    warnings.push(`produtos: ${err.message}`)
  }

  if (catalogId) {
    try {
      steps.visibility = await reconcileShowcaseVisibility({ db, token: accessToken, catalogId })
    } catch (err) {
      warnings.push(`vitrine: ${err.message}`)
    }
  }

  return { ok: warnings.length === 0, catalog_id: catalogId, steps, warnings }
}
