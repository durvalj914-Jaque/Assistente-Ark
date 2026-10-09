// GET /api/scheduler/reminders — varredura global de lembretes (cron da Vercel).
// Protegido por CRON_SECRET (header x-cron-secret) quando a env existir.
// Também roda de forma oportunista no webhook de cada mensagem recebida.
import { supabaseAdmin } from '../../../lib/supabase'
import { sendDueReminders, nowSP } from '../../../lib/scheduleEngine'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const secret = process.env.CRON_SECRET
  // Aceita: header próprio x-cron-secret OU Authorization: Bearer <CRON_SECRET>
  // (formato que a Vercel envia automaticamente nas invocações de cron)
  if (secret) {
    const ok = req.headers['x-cron-secret'] === secret
      || req.headers['authorization'] === `Bearer ${secret}`
    if (!ok) return res.status(401).json({ error: 'Não autorizado' })
  }

  const db = supabaseAdmin()
  const now = nowSP()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Tenants com agendamentos hoje aguardando lembrete
  const { data: due } = await db.from('appointments')
    .select('tenant_id').eq('date', todayStr)
    .in('status', ['confirmed', 'pending_payment'])
    .is('reminder_sent_at', null)
  const tenants = [...new Set((due || []).map(a => a.tenant_id))]
  if (!tenants.length) return res.status(200).json({ ok: true, sent: 0 })

  // Bots ativos desses tenants (um por tenant)
  const { data: bots } = await db.from('bots')
    .select('id, tenant_id, phone_number_id, access_token, status')
    .in('tenant_id', tenants).eq('status', 'active')
  const byTenant = {}
  for (const b of (bots || [])) if (!byTenant[b.tenant_id]) byTenant[b.tenant_id] = b

  let total = 0
  for (const tid of tenants) {
    const bot = byTenant[tid]
    if (!bot) continue
    total += await sendDueReminders(db, bot)
  }
  return res.status(200).json({ ok: true, tenants: tenants.length, sent: total })
}
