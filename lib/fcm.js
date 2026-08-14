import admin from 'firebase-admin'
import { supabaseAdmin } from './supabase'

let app = null
function getApp() {
  if (app) return app
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada')
  const creds = JSON.parse(raw)
  app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(creds) })
  return app
}

// Manda push nativo (Firebase Cloud Messaging) pra todos os devices Android
// inscritos de um tenant. Verifica se o tipo está habilitado nas configurações.
// Nunca lança erro pro chamador — best-effort.
export async function sendFcmToTenant(tenantId, { title, body, url, tag, type }) {
  try {
    getApp()
  } catch (e) {
    return
  }

  const db = supabaseAdmin()

  // Verificar se este tipo de notificação está habilitado
  if (type) {
    const { data: tenant } = await db.from('tenants').select('notification_settings').eq('id', tenantId).maybeSingle()
    const eventSettings = tenant?.notification_settings?.[type]
    if (eventSettings && eventSettings.enabled === false) return
  }

  const { data: tokens, error } = await db
    .from('fcm_tokens')
    .select('id, token')
    .eq('tenant_id', tenantId)

  if (error || !tokens?.length) return

  // Padrões de vibração por tipo
  const VIBRATE_BY_TYPE = {
    human_handoff: [300, 150, 300, 150, 300],
    no_bot_message: [100],
    new_order: [200, 100, 200],
    receipt: [200, 100, 200],
    loop_detected: [100, 50, 100, 50, 100, 50, 200],
  }
  const vibrate = VIBRATE_BY_TYPE[type] || [200, 100, 200]

  const messaging = admin.messaging()

  await Promise.all(tokens.map(async (t) => {
    try {
      await messaging.send({
        token: t.token,
        notification: { title, body },
        data: { url: url || '/admin/conversations', tag: tag || 'ark-notification', type: type || 'human_handoff' },
        android: {
          priority: 'high',
          notification: {
            channelId: type === 'human_handoff' ? 'ark_human_handoff' : 'ark_notifications',
            sound: 'default',
            defaultVibrateTimings: false,
            vibrateTimingsMillis: vibrate,
          },
        },
      })
    } catch (err) {
      if (err?.code === 'messaging/registration-token-not-registered' || err?.code === 'messaging/invalid-registration-token') {
        await db.from('fcm_tokens').delete().eq('id', t.id)
      } else {
        console.error('[fcm] erro ao enviar:', err?.message)
      }
    }
  }))
}
