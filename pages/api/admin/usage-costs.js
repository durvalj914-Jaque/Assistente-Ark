import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const db = getDB()
  const { tenant_id, month } = req.query
  const targetMonth = month || new Date().toISOString().slice(0, 7)

  try {
    // Se tenant_id específico, retornar detalhe dele
    if (tenant_id) {
      const { data: usage, error } = await db.rpc('get_usage_detailed', {
        p_tenant_id: tenant_id,
        p_month: targetMonth,
      })

      if (error) throw error

      // Buscar janelas de conversa do mês
      const { data: windows, error: wErr } = await db
        .from('conversation_windows')
        .select('id, origin_type, category, phone_number, opened_at, cost_brl')
        .eq('tenant_id', tenant_id)
        .eq('month', targetMonth)
        .order('opened_at', { ascending: false })
        .limit(100)

      return res.status(200).json({
        tenant_id,
        month: targetMonth,
        usage: usage || {},
        conversation_windows: windows || [],
      })
    }

    // Sem tenant_id: retornar resumo de todos os tenants
    const { data: usageRows, error } = await db
      .from('usage')
      .select(`
        tenant_id,
        month,
        business_initiated_conversations,
        service_messages,
        total_messages,
        marketing_conversations,
        utility_conversations,
        auth_conversations,
        meta_cost_brl,
        tenants(name)
      `)
      .eq('month', targetMonth)
      .order('business_initiated_conversations', { ascending: false })

    if (error) throw error

    // Calcular totais
    const totals = (usageRows || []).reduce((acc, row) => ({
      business_initiated: acc.business_initiated + (row.business_initiated_conversations || 0),
      service_messages: acc.service_messages + (row.service_messages || 0),
      total_messages: acc.total_messages + (row.total_messages || 0),
      marketing: acc.marketing + (row.marketing_conversations || 0),
      utility: acc.utility + (row.utility_conversations || 0),
      auth: acc.auth + (row.auth_conversations || 0),
      meta_cost: acc.meta_cost + (Number(row.meta_cost_brl) || 0),
    }), { business_initiated: 0, service_messages: 0, total_messages: 0, marketing: 0, utility: 0, auth: 0, meta_cost: 0 })

    return res.status(200).json({
      month: targetMonth,
      totals,
      tenants: usageRows || [],
    })
  } catch (err) {
    console.error('[usage/costs] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
