// Integração com o Catálogo de Produtos da Meta (WhatsApp Commerce API).
//
// ARQUITETURA IMPORTANTE: a Meta permite apenas UM catálogo por WABA. Como
// todos os tenants da Arkiel compartilham a mesma WABA, existe um único
// catálogo "Arkiel - Catálogo Unificado" pra todo mundo — os produtos de
// cada cliente são isolados por retailer_id prefixado (`t{tenant_id}_p{id}`)
// e o bot NUNCA expõe o catálogo inteiro: cada mensagem de catálogo enviada
// referencia apenas os retailer_ids daquele tenant específico.
import axios from 'axios'

const GRAPH = 'https://graph.facebook.com/v20.0'

export function retailerIdFor(tenantId, productId) {
  return `t${tenantId}_p${productId}`.replace(/-/g, '')
}

function priceString(price, currency = 'BRL') {
  const n = Number(price || 0)
  return `${n.toFixed(2)} ${currency}`
}

// Cria ou atualiza (upsert por retailer_id) um produto no catálogo Meta.
export async function upsertCatalogProduct(product, tenantId) {
  const catalogId = process.env.ARKIEL_META_CATALOG_ID
  const token = process.env.META_SYSTEM_USER_TOKEN
  if (!catalogId || !token) return { skipped: true, reason: 'catalog_not_configured' }

  const retailerId = retailerIdFor(tenantId, product.id)
  const fallbackImage = 'https://arkiel.com.br/assets/assistente-ark-logo.png'

  try {
    const res = await axios.post(`${GRAPH}/${catalogId}/products`, null, {
      params: {
        retailer_id: retailerId,
        name: product.name,
        description: product.description || product.name,
        price: priceString(product.price),
        currency: 'BRL',
        image_url: product.image_url || fallbackImage,
        url: `https://arkiel.com.br/p/${retailerId}`,
        availability: product.is_active && (product.stock === null || product.stock === undefined || product.stock > 0) ? 'in stock' : 'out of stock',
        condition: 'new',
        brand: 'Arkiel',
        access_token: token,
      }
    })
    return { ok: true, retailerId, meta: res.data }
  } catch (err) {
    return { ok: false, retailerId, error: err?.response?.data?.error?.message || err.message }
  }
}

// Marca como fora de estoque (a Meta não tem delete simples por retailer_id
// sem o ID interno do produto — "out of stock" some do catálogo ativo, que é
// o efeito prático desejado quando um produto é apagado no painel).
export async function removeCatalogProduct(product, tenantId) {
  const catalogId = process.env.ARKIEL_META_CATALOG_ID
  const token = process.env.META_SYSTEM_USER_TOKEN
  if (!catalogId || !token) return { skipped: true }

  const retailerId = retailerIdFor(tenantId, product.id)
  try {
    const res = await axios.post(`${GRAPH}/${catalogId}/products`, null, {
      params: { retailer_id: retailerId, availability: 'out of stock', access_token: token }
    })
    return { ok: true, meta: res.data }
  } catch (err) {
    return { ok: false, error: err?.response?.data?.error?.message || err.message }
  }
}

// Envia Multi-Product Message (até 30 itens) — usada pelo nó "catalog" do fluxo.
export async function sendProductList({ phoneNumberId, token, to, headerText, bodyText, footerText, products, tenantId }) {
  const catalogId = process.env.ARKIEL_META_CATALOG_ID
  if (!catalogId) throw new Error('Catálogo não configurado (ARKIEL_META_CATALOG_ID ausente)')

  const items = products.slice(0, 30).map(p => ({ product_retailer_id: retailerIdFor(tenantId, p.id) }))
  if (!items.length) throw new Error('Nenhum produto ativo pra mostrar')

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'product_list',
      header: { type: 'text', text: headerText || 'Nosso catálogo' },
      body: { text: bodyText || 'Dá uma olhada nos nossos produtos 👇' },
      footer: footerText ? { text: footerText } : undefined,
      action: {
        catalog_id: catalogId,
        sections: [{ title: 'Produtos', product_items: items }],
      },
    },
  }

  const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(data))
  return data
}

// Envia Single-Product Message — 1 item só, em destaque.
export async function sendSingleProduct({ phoneNumberId, token, to, bodyText, footerText, product, tenantId }) {
  const catalogId = process.env.ARKIEL_META_CATALOG_ID
  if (!catalogId) throw new Error('Catálogo não configurado (ARKIEL_META_CATALOG_ID ausente)')

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'product',
      body: { text: bodyText || product.name },
      footer: footerText ? { text: footerText } : undefined,
      action: { catalog_id: catalogId, product_retailer_id: retailerIdFor(tenantId, product.id) },
    },
  }

  const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(JSON.stringify(data))
  return data
}
