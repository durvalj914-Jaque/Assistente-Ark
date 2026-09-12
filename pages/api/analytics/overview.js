/**
 * GET /api/analytics/overview?days=30
 *
 * Painel de inteligência comercial do Assistente Ark.
 * Calcula funil, conversas, bot, vendas, agendamentos e clientes
 * a partir das tabelas operacionais (leitura only — nunca escreve no financeiro).
 * Eventos brutos também são gravados em analytics_events pelos webhooks
 * (camada derivada, append-only).
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0)
const groupCount = (arr, f) => {
  const m = {}
  arr.forEach(x => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1 })
  return m
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member?.tenant_id) return res.status(403).json({ error: 'Sem tenant vinculado' })
  const tid = member.tenant_id

  const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365)
  const from = new Date(Date.now() - days * 86400000).toISOString()

  const [convsR, msgsR, ordersR, paysR, apptsR, servicesR, contactsR] = await Promise.all([
    db.from('conversations').select('id, status, contact_id, created_at')
      .eq('tenant_id', tid).gte('created_at', from).order('created_at', { ascending: true }).limit(2000),
    db.from('messages').select('id, direction, created_at')
      .eq('tenant_id', tid).gte('created_at', from).limit(5000),
    db.from('whatsapp_orders').select('id, status, total, created_at')
      .eq('tenant_id', tid).gte('created_at', from).limit(1000),
    db.from('payments').select('id, status, amount, product_name, customer_phone, customer_name, created_at')
      .eq('tenant_id', tid).gte('created_at', from).limit(1000),
    db.from('appointments').select('id, status, service_id, customer_name, created_at')
      .eq('tenant_id', tid).gte('created_at', from).limit(1000),
    db.from('services').select('id, name').eq('tenant_id', tid).limit(200),
    db.from('contacts').select('id, name, phone, created_at')
      .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(2000),
  ])

  const convList = convsR.data || []
  const msgList = msgsR.data || []
  const orderList = ordersR.data || []
  const payList = paysR.data || []
  const apptList = apptsR.data || []
  const services = servicesR.data || []
  const contactList = contactsR.data || []
  const svcName = Object.fromEntries(services.map(s => [s.id, s.name]))

  // ── Conversas ──
  const perDayMap = groupCount(convList, c => c.created_at?.slice(0, 10))
  const perDay = Object.entries(perDayMap).map(([date, count]) => ({ date, count }))
  const byHour = new Array(24).fill(0)
  msgList.forEach(m => { const h = new Date(m.created_at).getHours(); byHour[h] = (byHour[h] || 0) + 1 })
  const statusNow = groupCount(convList, c => c.status)
  const inbound = msgList.filter(m => m.direction === 'inbound').length
  const outbound = msgList.filter(m => m.direction === 'outbound').length

  // ── Bot (coorte do período) ──
  const humanStatuses = ['human', 'no_bot']
  const automated = convList.filter(c => !humanStatuses.includes(c.status)).length
  const human = convList.filter(c => humanStatuses.includes(c.status)).length

  // ── Vendas ──
  const paidPays = payList.filter(p => p.status === 'paid')
  const paidBrl = sum(paidPays, p => p.amount)
  const avgTicket = paidPays.length ? paidBrl / paidPays.length : 0
  const prodMap = {}
  paidPays.forEach(p => {
    const k = p.product_name || 'Cobrança no chat'
    prodMap[k] = prodMap[k] || { name: k, count: 0, brl: 0 }
    prodMap[k].count++
    prodMap[k].brl += Number(p.amount) || 0
  })
  const topProducts = Object.values(prodMap).sort((a, b) => b.brl - a.brl).slice(0, 5)

  // ── Funil do negócio ──
  const funnel = {
    conversations: convList.length,
    orders: orderList.length,
    paymentsCreated: payList.length,
    paymentsConfirmed: paidPays.length,
    conversion: convList.length ? Number(((paidPays.length / convList.length) * 100).toFixed(2)) : 0,
  }

  // ── Agendamentos ──
  const apptConfirmed = apptList.filter(a => a.status === 'confirmed').length
  const apptCancelled = apptList.filter(a => a.status === 'cancelled').length
  const svcMap = {}
  apptList.forEach(a => {
    const k = svcName[a.service_id] || a.service_id || 'Serviço'
    svcMap[k] = (svcMap[k] || 0) + 1
  })
  const topServices = Object.entries(svcMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

  // ── Clientes ──
  const newClients = contactList.filter(c => c.created_at >= from).length
  const convsByContact = groupCount(convList, c => c.contact_id)
  const recurringClients = Object.values(convsByContact).filter(n => n >= 2).length
  const clientsAttended = Object.keys(convsByContact).length
  const cliMap = {}
  paidPays.forEach(p => {
    const k = p.customer_phone || p.customer_name || '?'
    cliMap[k] = cliMap[k] || { name: p.customer_name || p.customer_phone || 'Cliente', phone: p.customer_phone || null, purchases: 0, spent: 0 }
    cliMap[k].purchases++
    cliMap[k].spent += Number(p.amount) || 0
  })
  const topClients = Object.values(cliMap).sort((a, b) => b.spent - a.spent).slice(0, 5)

  return res.status(200).json({
    days,
    from,
    funnel,
    overview: {
      conversations: convList.length,
      clientsAttended,
      inbound,
      outbound,
      automated,
      human,
      salesCount: paidPays.length,
      salesBrl: Number(paidBrl.toFixed(2)),
      avgTicket: Number(avgTicket.toFixed(2)),
      appointmentsConfirmed: apptConfirmed,
      newClients,
      recurringClients,
    },
    conversations: { perDay, byHour, statusNow, inbound, outbound },
    bot: {
      automated,
      human,
      automatedPct: convList.length ? Number(((automated / convList.length) * 100).toFixed(1)) : null,
    },
    sales: {
      paidCount: paidPays.length,
      paidBrl: Number(paidBrl.toFixed(2)),
      avgTicket: Number(avgTicket.toFixed(2)),
      cancelled: payList.filter(p => p.status === 'cancelled' || p.status === 'expired').length,
      pending: payList.filter(p => p.status === 'pending').length,
      topProducts,
    },
    appointments: {
      created: apptList.length,
      confirmed: apptConfirmed,
      cancelled: apptCancelled,
      conversion: apptList.length ? Number(((apptConfirmed / apptList.length) * 100).toFixed(1)) : null,
      topServices,
    },
    clients: { newCount: newClients, recurringCount: recurringClients, topClients },
  })
}
