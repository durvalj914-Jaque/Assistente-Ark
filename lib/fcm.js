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
// inscritos de um tenant. Nunca lança erro pro chamador — best-effort.
export async function sendFcmToTenant(tenantId, { title, body, url, tag }) {
  try {
    getApp()
  } catch (e) {
    // Ainda não configurado (esperando o service account do Firebase) — silencioso.
    return
  }

  const db = supabaseAdmin()
  const { data: tokens, error } = await db
    .from('fcm_tokens')
    .select('id, token')
    .eq('tenant_id', tenantId)

  if (error || !tokens?.length) return

  const messaging = admin.messaging()

  await Promise.all(tokens.map(async (t) => {
    try {
      await messaging.send({
        token: t.token,
        notification: { title, body },
        data: { url: url || '/admin/conversations', tag: tag || 'ark-notification' },
        android: {
          priority: 'high',
          notification: {
            channelId: 'ark_human_handoff',
            sound: 'default',
            defaultVibrateTimings: false,
            vibrateTimingsMillis: [300, 150, 300, 150, 300],
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
