/**
 * POST /api/admin/setup-catalog
 * Endpoint ÚNICO/ADMINISTRATIVO — cria (uma vez só) o catálogo de produtos
 * compartilhado da Arkiel na Meta e conecta na WABA compartilhada.
 *
 * IMPORTANTE: a Meta só permite UM catálogo por WABA. Como todos os clientes
 * da Arkiel usam a MESMA WABA compartilhada, existe apenas UM catálogo pra
 * todos os tenants — os produtos de cada cliente ficam isolados por
 * retailer_id prefixado com o tenant_id, e o bot só envia os itens daquele
 * tenant específico nas mensagens (nunca expõe o catálogo inteiro).
 *
 * Idempotente: se ARKIEL_META_CATALOG_ID já existir no ambiente, apenas
 * confirma que a conexão com a WABA está OK.
 *
 * Header: Authorization: Bearer <supabase_session_token> (platform admin)
 */
import axios from 'axios'
import { requirePlatformAdmin } from '../../../lib/adminAuth'

const GRAPH = 'https://graph.facebook.com/v20.0'
const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return

  const systemToken = process.env.META_SYSTEM_USER_TOKEN
  if (!systemToken) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN não configurado' })

  const steps = {}

  try {
    // 1. Descobre o Business Manager dono da WABA
    const wabaRes = await axios.get(`${GRAPH}/${SHARED_WABA_ID}`, {
      params: { fields: 'id,name,owner_business_info', access_token: systemToken }
    })
    steps.waba = wabaRes.data
    const businessId = wabaRes.data?.owner_business_info?.id
    if (!businessId) {
      return res.status(500).json({ error: 'Não foi possível descobrir o Business Manager dono da WABA', steps })
    }

    // 2. Cria (ou reaproveita) o catálogo
    let catalogId = process.env.ARKIEL_META_CATALOG_ID
    if (!catalogId) {
      const catRes = await axios.post(`${GRAPH}/${businessId}/owned_product_catalogs`, null, {
        params: {
          name: 'Arkiel - Catálogo Unificado',
          vertical: 'commerce',
          access_token: systemToken,
        }
      })
      catalogId = catRes.data?.id
      steps.catalog_created = catRes.data
    } else {
      steps.catalog_reused = { id: catalogId }
    }

    if (!catalogId) return res.status(500).json({ error: 'Meta não retornou um ID de catálogo', steps })

    // 3. Conecta o catálogo na WABA compartilhada
    try {
      const connectRes = await axios.post(`${GRAPH}/${SHARED_WABA_ID}/product_catalogs`, null, {
        params: { catalog_id: catalogId, access_token: systemToken }
      })
      steps.connected = connectRes.data
    } catch (connErr) {
      const msg = connErr?.response?.data?.error?.message || ''
      // Já conectado — não é erro
      if (/already|existente/i.test(msg)) {
        steps.connected = { already: true }
      } else {
        throw connErr
      }
    }

    return res.status(200).json({
      ok: true,
      business_id: businessId,
      catalog_id: catalogId,
      steps,
      next_step: `Salve ARKIEL_META_CATALOG_ID=${catalogId} nas env vars da Vercel pra ativar a sincronização de produtos.`,
    })
  } catch (err) {
    const metaErr = err?.response?.data?.error
    console.error('[setup-catalog] erro:', metaErr || err.message)
    return res.status(500).json({
      error: metaErr?.error_user_msg || metaErr?.message || err.message,
      meta_error_code: metaErr?.code,
      meta_error_subcode: metaErr?.error_subcode,
      steps,
    })
  }
}
