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

    // ── Regra comercial: o 1º fluxo sazonal do tenant é GRÁTIS (o gostinho);
    //    os demais são pagos com PIX único, pra sempre, por bot. ──
    const { count: owned } = await db.from('flow_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if ((owned || 0) === 0) {
      const { error: insErr } = await db.from('flow_subscriptions').insert({
        tenant_id: tenantId, bot_id, seasonal_flow_id, status: 'active', payment_status: 'free',
      })
      if (insErr) return res.status(500).json({ error: insErr.message })
      return res.json({ ok: true, status: 'active', free: true })
    }

    // ── Pago: gera PIX único (recebido pela Arkiel) e ativa quando o MP confirmar ──
    const { data: flow } = await db.from('seasonal_flows')
      .select('name, price, emoji').eq('id', seasonal_flow_id).maybeSingle()
    if (!flow) return res.status(404).json({ error: 'Fluxo sazonal não encontrado' })
    const amount = Number(flow.price) || 29.90
    const flowName = flow.name

    // Idempotência: PIX pendente <10min pro mesmo bot+fluxo reaproveita o código
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recent } = await db.from('payments')
      .select('id, pix_code, pix_qr_url')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gte('created_at', tenMinAgo)
      .order('created_at', { ascending: false })
      .limit(10)
    const prev = (recent || []).find(r => {
      try { const m = JSON.parse(r.pix_qr_url || '{}'); return m.type === 'seasonal_flow_purchase' && m.bot_id === bot_id && m.seasonal_flow_id === seasonal_flow_id } catch (_) { return false }
    })
    if (prev) {
      const m = JSON.parse(prev.pix_qr_url || '{}')
      return res.json({ ok: true, requires_payment: true, amount, flow_name: flowName, payment_id: prev.id, pix_code: m.pix_emv, pix_qr: m.pix_qr_image, reused: true })
    }

    const txid = `SZN${Date.now().toString(36).toUpperCase()}`
    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2 || process.env.MERCADOPAGO_ACCESS_TOKEN
    let pixCode = null, pixQr = null, mpError = null

    if (mpToken) {
      try {
        const pixRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `seasonal-${txid}` },
          body: JSON.stringify({
            transaction_amount: amount,
            description: `Fluxo Sazonal "${flowName}" — Assistente Ark`,
            payment_method_id: 'pix',
            external_reference: txid,
            payer: { email: `tenant-${tenantId.substring(0, 8)}@arkiel.com.br` },
            metadata: { type: 'seasonal_flow_purchase', tenant_id: tenantId, bot_id, seasonal_flow_id, flow_name: flowName },
            notification_url: 'https://www.assistente-ark.com.br/api/payments/webhook/mercadopago',
          }),
        })
        const d = await pixRes.json()
        const tdata = d?.point_of_interaction?.transaction_data
        if (pixRes.ok && tdata?.qr_code) {
          pixCode = tdata.qr_code
          pixQr = 'data:image/png;base64,' + tdata.qr_code_base64
        } else {
          mpError = JSON.stringify(d).substring(0, 300)
          console.error('[seasonal/catalog] MP falhou:', mpError)
        }
      } catch (e) { mpError = e.message }
    }

    if (!pixCode) {
      try {
        const { generatePixCode } = await import('../../../lib/pix')
        const { default: QRCodeModule } = await import('qrcode')
        pixCode = generatePixCode({
          pixKey: process.env.ARKIEL_PIX_KEY || 'arkieltech@gmail.com',
          merchantName: process.env.ARKIEL_MERCHANT_NAME || 'ARKIEL TECNOLOGIA',
          merchantCity: process.env.ARKIEL_MERCHANT_CITY || 'SAO PAULO',
          amount, txid,
        })
        pixQr = await QRCodeModule.toDataURL(pixCode, { width: 400, margin: 2 })
      } catch (e) {
        return res.status(500).json({ error: 'Erro ao gerar PIX: ' + e.message })
      }
    }

    const meta = JSON.stringify({
      type: 'seasonal_flow_purchase', tenant_id: tenantId, bot_id,
      seasonal_flow_id, flow_name: flowName, amount,
      pix_emv: pixCode, pix_qr_image: pixQr, mp_error: mpError,
    })
    let paymentId = null
    try {
      const { data: payment } = await db.from('payments').insert({
        tenant_id: tenantId, amount, status: 'pending', pix_code: txid, pix_qr_url: meta,
      }).select('id').single()
      paymentId = payment?.id
    } catch (e) { console.error('[seasonal/catalog] payment insert:', e.message) }

    return res.json({ ok: true, requires_payment: true, amount, flow_name: flowName, payment_id: paymentId, pix_code: pixCode, pix_qr: pixQr })
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
