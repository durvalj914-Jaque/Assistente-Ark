import webpush from 'web-push'
import { supabaseAdmin } from './supabase'

let configured = false
function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new Error('VAPID keys não configuradas')
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:arkieltech@gmail.com',
    publicKey,
    privateKey
  )
  configured = true
}

// Manda uma notificação push pra todos os dispositivos inscritos de um tenant.
// Verifica se o tipo de evento está habilitado nas configurações do tenant.
// Nunca lança erro pro chamador — é best-effort, não pode travar o webhook.
export async function sendPushToTenant(tenantId, { title, body, url, tag, type }) {
  try {
    ensureConfigured()
  } catch (e) {
    console.error('[webpush] VAPID não configuradas:', e.message)
    return
  }

  const db = supabaseAdmin()

  // Verificar se este tipo de notificação está habilitado nas configurações do tenant
  if (type) {
    const { data: tenant } = await db.from('tenants').select('notification_settings').eq('id', tenantId).maybeSingle()
    const eventSettings = tenant?.notification_settings?.[type]
    if (eventSettings && eventSettings.enabled === false) return // Tipo desativado pelo usuário
  }

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)

  if (error || !subs?.length) return

  const payload = JSON.stringify({ title, body, url, tag, type })

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    } catch (err) {
      // 404/410 = inscrição expirada ou revogada pelo navegador — remove do banco.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('[webpush] erro ao enviar:', err?.message)
      }
    }
  }))
}
