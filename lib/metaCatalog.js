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

function priceString(price) {
  // Meta exige preço em centavos como número inteiro (ex: 99.90 -> 9990)
  return Math.round(Number(price || 0) * 100)
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

// Remove o produto do catálogo Meta: primeiro tenta o DELETE real do item
// (funciona com o product item id — descobrimos empiricamente que DELETE /{id}
// retorna success). Sem o id interno, busca por retailer_id; se não achar,
// marca out of stock como último recurso.
export async function removeCatalogProduct(product, tenantId) {
  const catalogId = process.env.ARKIEL_META_CATALOG_ID
  const token = process.env.META_SYSTEM_USER_TOKEN
  if (!catalogId || !token) return { skipped: true }

  const retailerId = retailerIdFor(tenantId, product.id)

  // 1) DELETE direto se temos o id interno salvo
  if (product.meta_product_id) {
    try {
      await axios.delete(`${GRAPH}/${product.meta_product_id}`, { params: { access_token: token } })
      return { ok: true, deleted: true }
    } catch (err) {
      console.error('[catalog] delete por meta_product_id falhou:', err?.response?.data?.error?.message)
    }
  }

  // 2) Busca o item por retailer_id e deleta
  try {
    const search = await axios.get(`${GRAPH}/${catalogId}/products`, {
      params: {
        filter: JSON.stringify({ retailer_id: { eq: retailerId } }),
        fields: 'id,retailer_id',
        access_token: token,
      },
    })
    const item = search.data?.data?.[0]
    if (item?.id) {
      await axios.delete(`${GRAPH}/${item.id}`, { params: { access_token: token } })
      return { ok: true, deleted: true, meta_product_id: item.id }
    }
  } catch (err) {
    console.error('[catalog] busca/delete por retailer_id falhou:', err?.response?.data?.error?.message)
  }

  // 3) Último recurso: out of stock (some do catálogo ativo)
  try {
    const res = await axios.post(`${GRAPH}/${catalogId}/products`, null, {
      params: {
        retailer_id: retailerId,
        name: product.name || 'Produto removido',
        description: 'Produto removido do catálogo',
        price: priceString(product.price || 0),
        currency: 'BRL',
        image_url: product.image_url || 'https://arkiel.com.br/assets/assistente-ark-logo.png',
        availability: 'out of stock',
        condition: 'new',
        brand: 'Arkiel',
        access_token: token,
      }
    })
    return { ok: true, out_of_stock: true, meta: res.data }
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

// ── FALLBACK: Envia produtos como mensagem rica (imagem + botão de compra) ──
// Usado quando o catálogo nativo da Meta não está disponível (permissão ou config).
export async function sendProductRich({ phoneNumberId, token, to, product, index, total }) {
  const WA = 'https://graph.facebook.com/v19.0'
  const price = Number(product.price || 0).toFixed(2).replace('.', ',')

  // 1. Se tem imagem, envia como imagem com caption
  if (product.image_url) {
    try {
      // Baixar a imagem e subir no WhatsApp
      const imgRes = await fetch(product.image_url)
      if (imgRes.ok) {
        const imgBuf = await imgRes.arrayBuffer()
        const contentType = imgRes.headers.get('content-type') || 'image/png'
        const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png'
        const blob = new Blob([imgBuf], { type: contentType })
        const fd = new FormData()
        fd.append('messaging_product', 'whatsapp')
        fd.append('type', contentType)
        fd.append('file', blob, `product.${ext}`)

        const upRes = await fetch(`${WA}/${phoneNumberId}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const upData = await upRes.json()

        if (upData.id) {
          // Enviar imagem com caption
          const caption = `📦 *${product.name}*\n\n${product.description || ''}\n\n💰 *R$ ${price}*`
          await fetch(`${WA}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp', to, type: 'image',
              image: { id: upData.id, caption },
            }),
          })
        }
      }
    } catch (_) { /* se falhar, envia só texto */ }
  }

  // 2. Envia botão interativo de compra
  const bodyText = `💰 *${product.name}* — R$ ${price}${product.description ? `\n\n${product.description}` : ''}${index !== undefined && total !== undefined ? `\n\n_item ${index + 1} de ${total}_` : ''}`
  const replyId = `buy_${product.id}`

  const r = await fetch(`${WA}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: replyId, title: '🛒 Comprar' } },
          ],
        },
      },
    }),
  })
  return await r.json()
}

// Envia mensagem de lista de produtos (fallback multi-produto)
export async function sendProductListFallback({ phoneNumberId, token, to, products, tenantId }) {
  const WA = 'https://graph.facebook.com/v19.0'
  // WhatsApp list message: até 10 itens por seção
  const rows = products.slice(0, 10).map(p => ({
    id: `prod_${p.id.substring(0, 8)}`,
    title: p.name.substring(0, 24),
    description: `R$ ${Number(p.price || 0).toFixed(2).replace('.', ',')}${p.description ? ' — ' + p.description.substring(0, 40) : ''}`,
  }))

  const r = await fetch(`${WA}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: '🛍️ Catálogo' },
        body: { text: 'Escolha um produto para ver detalhes e comprar:' },
        action: {
          button: 'Ver produtos',
          sections: [{ title: 'Produtos disponíveis', rows }],
        },
      },
    }),
  })
  return await r.json()
}
