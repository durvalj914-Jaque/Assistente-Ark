// TEMPORÁRIO: diagnóstico/correção do callback do webhook da Meta.
// Guardado pelo CRON_SECRET. Remover após o uso.
export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || (req.headers.authorization || '').replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' })

  const APP_ID = process.env.META_APP_ID
  const APP_SECRET = process.env.META_APP_SECRET
  if (!APP_ID || !APP_SECRET) return res.status(500).json({ ok: false, error: 'missing app creds' })
  const appToken = `${APP_ID}|${APP_SECRET}`
  const graph = 'https://graph.facebook.com/v25.0'

  const r = await fetch(`${graph}/${APP_ID}/subscriptions?access_token=${encodeURIComponent(appToken)}`)
  const subs = await r.json()

  if (req.method === 'GET') {
    return res.status(r.ok ? 200 : 500).json({ ok: r.ok, subscriptions: subs })
  }

  if (req.method === 'POST') {
    const target = req.query.url || 'https://www.assistente-ark.com.br/api/webhook'
    const vt = req.query.verify_token || process.env.WEBHOOK_VERIFY_TOKEN || 'ark_secret_arkiel_2025'
    const wa = (subs.data || []).find(s => s.object === 'whatsapp_business_account') || (subs.data || [])[0] || {}
    const fieldNames = (wa.fields || []).map(f => typeof f === 'string' ? f : f.name).filter(Boolean)
    const fields = (fieldNames.length ? fieldNames : ['messages', 'message_template_status_update']).join(',')
    const body = new URLSearchParams({ object: wa.object || 'whatsapp_business_account', callback_url: target, verify_token: vt, fields })
    const r2 = await fetch(`${graph}/${APP_ID}/subscriptions?access_token=${encodeURIComponent(appToken)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    })
    const out = await r2.json().catch(() => ({}))
    const r3 = await fetch(`${graph}/${APP_ID}/subscriptions?access_token=${encodeURIComponent(appToken)}`)
    return res.status(r2.ok ? 200 : 500).json({ ok: r2.ok, update: out, fields, subscriptions: await r3.json() })
  }

  return res.status(405).json({ ok: false })
}
