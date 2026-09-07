import { createClient } from '@supabase/supabase-js'

const TOKEN = process.env.META_SYSTEM_USER_TOKEN
const API = process.env.META_API_VERSION || 'v25.0'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado' })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const token = auth.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Sessão inválida' })

    // achar tenant + waba/phone do usuário
    const { data: member } = await supabase.from('tenant_members').select('tenant_id').eq('user_id', user.id).limit(1)
    if (!member?.length) return res.status(403).json({ error: 'Sem tenant' })
    const tenantId = member[0].tenant_id
    const { data: bot } = await supabase.from('bots').select('phone_number_id, waba_id').eq('tenant_id', tenantId).limit(1)
    if (!bot?.length) return res.status(404).json({ error: 'Nenhum WhatsApp conectado' })
    const phoneId = bot[0].phone_number_id
    const wabaId = bot[0].waba_id || '1867398900635798'

    if (!TOKEN) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN não configurado' })

    // período: últimos 7 dias (ou query params start/end)
    const end = req.query.end || new Date().toISOString().slice(0, 10)
    const start = req.query.start || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

    // Conversation Analytics oficial da Meta — contagem e custo por categoria
    const url = `https://graph.facebook.com/${API}/${wabaId}/conversation_analytics` +
      `?start=${start}&end=${end}&granularity=DAILY&phone_numbers=[${phoneId}]&metrics=[CONVERSATION,COST]`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
    const data = await r.json()
    if (!r.ok) {
      return res.status(502).json({ error: 'Meta API: ' + (data?.error?.message || r.status), meta_error: data?.error })
    }

    // agregação simples por categoria
    let agg = { total_conversations: 0, total_cost: 0, by_category: {} }
    for (const row of data?.data || []) {
      for (const [d, point] of Object.entries(row.data_points || {})) {
        if (!point) continue
        agg.total_conversations += point.conversation || 0
        agg.total_cost += parseFloat(point.cost) || 0
        for (const [cat, v] of Object.entries(point.conversation_categories || {})) {
          if (!agg.by_category[cat]) agg.by_category[cat] = { conversations: 0, cost: 0 }
          agg.by_category[cat].conversations += v.conversation || 0
          agg.by_category[cat].cost += parseFloat(v.cost) || 0
        }
      }
    }

    // comparar com nosso tracking (conversation_windows) no mesmo período
    const { data: ours } = await supabase.from('conversation_windows')
      .select('origin_type, cost_brl')
      .gte('opened_at', start)
      .lte('opened_at', end + ' 23:59:59')
      .eq('tenant_id', tenantId)
    let ourAgg = { total: ours?.length || 0, cost: 0, by_type: {} }
    for (const w of ours || []) {
      ourAgg.cost += parseFloat(w.cost_brl) || 0
      ourAgg.by_type[w.origin_type] = (ourAgg.by_type[w.origin_type] || 0) + 1
    }

    res.json({ period: { start, end }, meta_official: agg, our_tracking: ourAgg, raw: data?.data?.slice(0, 3) })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
