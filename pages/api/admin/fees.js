/**
 * /api/admin/fees
 * 
 * GET  — Lista taxas pendentes e histórico de cobranças da plataforma
 *   ?status=pending  → só pendentes
 *   ?tenant_id=xxx   → filtra por tenant
 *   ?summary=true    → retorna resumo agregado por tenant
 * 
 * POST — Ações:
 *   { action: 'generate_invoice', tenant_id: 'xxx' }
 *     Gera um PIX de cobrança mensal para o tenant via Mercado Pago
 *   { action: 'mark_collected', fee_ids: ['id1','id2'] }
 *     Marca taxas específicas como coletadas (pagamento manual confirmado)
 *   { action: 'waive', fee_id: 'xxx' }
 *     Dispensa uma taxa individual
 * 
 * Requer: platform admin
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  if (req.method === 'GET') {
    const { status, tenant_id, summary } = req.query

    if (summary === 'true') {
      // Aggregate: total pending, collected, by tenant
      const { data: fees, error } = await db.from('platform_fees')
        .select('tenant_id, status, fee_amount, gross_amount, payment_method')
        .order('created_at', { ascending: false })

      if (error) return res.status(500).json({ error: error.message })

      const byTenant = {}
      for (const f of fees || []) {
        if (!byTenant[f.tenant_id]) {
          byTenant[f.tenant_id] = {
            tenant_id: f.tenant_id,
            pending_count: 0, pending_amount: 0,
            collected_count: 0, collected_amount: 0,
            invoiced_count: 0, invoiced_amount: 0,
            total_volume: 0
          }
        }
        const t = byTenant[f.tenant_id]
        if (f.status === 'pending') { t.pending_count++; t.pending_amount += parseFloat(f.fee_amount) }
        else if (f.status === 'collected') { t.collected_count++; t.collected_amount += parseFloat(f.fee_amount) }
        else if (f.status === 'invoiced') { t.invoiced_count++; t.invoiced_amount += parseFloat(f.fee_amount) }
        t.total_volume += parseFloat(f.gross_amount)
      }

      // Get tenant names
      const tenantIds = Object.keys(byTenant)
      if (tenantIds.length > 0) {
        const { data: tenants } = await db.from('tenants')
          .select('id, name')
          .in('id', tenantIds)
        for (const t of tenants || []) {
          if (byTenant[t.id]) byTenant[t.id].tenant_name = t.name
        }
      }

      const summaryData = {
        tenants: Object.values(byTenant),
        totals: {
          pending_amount: Object.values(byTenant).reduce((s, t) => s + t.pending_amount, 0),
          collected_amount: Object.values(byTenant).reduce((s, t) => s + t.collected_amount, 0),
          invoiced_amount: Object.values(byTenant).reduce((s, t) => s + t.invoiced_amount, 0),
          total_volume: Object.values(byTenant).reduce((s, t) => s + t.total_volume, 0),
        }
      }
      return res.status(200).json(summaryData)
    }

    let query = db.from('platform_fees').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (tenant_id) query = query.eq('tenant_id', tenant_id)
    query = query.limit(500)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Enrich with tenant names
    if (data && data.length > 0) {
      const tenantIds = [...new Set(data.map(f => f.tenant_id))]
      const { data: tenants } = await db.from('tenants').select('id, name').in('id', tenantIds)
      const tenantMap = {}
      for (const t of tenants || []) tenantMap[t.id] = t.name
      for (const f of data) f.tenant_name = tenantMap[f.tenant_id] || 'Desconhecido'
    }

    return res.status(200).json({ fees: data || [] })
  }

  if (req.method === 'POST') {
    const { action } = req.body

    // ── Generate monthly invoice (PIX charge via MP) ──
    if (action === 'generate_invoice') {
      const { tenant_id } = req.body
      if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

      // Sum all pending fees for this tenant
      const { data: pendingFees, error } = await db.from('platform_fees')
        .select('id, fee_amount')
        .eq('tenant_id', tenant_id)
        .eq('status', 'pending')

      if (error) return res.status(500).json({ error: error.message })
      if (!pendingFees || pendingFees.length === 0) {
        return res.status(400).json({ error: 'Nenhuma taxa pendente para este tenant' })
      }

      const totalDue = pendingFees.reduce((s, f) => s + parseFloat(f.fee_amount), 0)
      const feeIds = pendingFees.map(f => f.id)

      // Get tenant name for description
      const { data: tenant } = await db.from('tenants').select('name').eq('id', tenant_id).maybeSingle()
      const tenantName = tenant?.name || 'Cliente'

      // Get Arkiel's MP token to create the charge
      const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
      if (!mpToken) return res.status(500).json({ error: 'Token do Mercado Pago não configurado' })

      // Create PIX charge
      const idempotencyKey = `arkiel-fee-${tenant_id}-${Date.now()}`
      const pixRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          transaction_amount: Number(totalDue.toFixed(2)),
          description: `Taxa plataforma Arkiel — ${pendingFees.length} transações — ${tenantName}`,
          payment_method_id: 'pix',
          payer: { email: 'plataforma@arkiel.com.br' },
          metadata: { type: 'platform_fee', tenant_id, fee_ids: feeIds }
        })
      })

      const pixData = await pixRes.json()

      if (pixData.id && pixData.point_of_interaction?.transaction_data?.qr_code) {
        // Mark fees as invoiced
        await db.from('platform_fees')
          .update({ status: 'invoiced', invoice_id: String(pixData.id), invoiced_at: new Date().toISOString() })
          .in('id', feeIds)

        return res.status(200).json({
          ok: true,
          invoice_id: String(pixData.id),
          amount: totalDue.toFixed(2),
          fee_count: pendingFees.length,
          pix_code: pixData.point_of_interaction.transaction_data.qr_code,
          pix_qr: pixData.point_of_interaction.transaction_data.qr_code_base64,
          message: `Cobrança de R$ ${totalDue.toFixed(2)} gerada para ${tenantName}`
        })
      } else {
        return res.status(500).json({ error: 'Erro ao criar PIX no MP: ' + (pixData.message || JSON.stringify(pixData)).substring(0, 200) })
      }
    }

    // ── Mark fees as collected (manual confirmation) ──
    if (action === 'mark_collected') {
      const { fee_ids } = req.body
      if (!fee_ids || !Array.isArray(fee_ids) || fee_ids.length === 0) {
        return res.status(400).json({ error: 'fee_ids é obrigatório' })
      }
      const { error } = await db.from('platform_fees')
        .update({ status: 'collected', collected_at: new Date().toISOString() })
        .in('id', fee_ids)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, count: fee_ids.length })
    }

    // ── Waive a fee ──
    if (action === 'waive') {
      const { fee_id } = req.body
      if (!fee_id) return res.status(400).json({ error: 'fee_id é obrigatório' })
      const { error } = await db.from('platform_fees')
        .update({ status: 'waived' })
        .eq('id', fee_id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Ação desconhecida' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
