// Service Worker do Assistente Ark — recebe pushes e mostra notificação
// com som + vibração diferenciados por tipo de evento.

self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })

// ── Padrões de vibração por tipo ──
const VIBRATION_BY_TYPE = {
  human_handoff: [300, 150, 300, 150, 300],
  no_bot_message: [100],
  new_order: [200, 100, 200],
  receipt: [200, 100, 200],
  loop_detected: [100, 50, 100, 50, 100, 50, 200],
}
const DEFAULT_VIBRATION = [200, 100, 200]

// ── Configurações de som por tipo (URLs para arquivos de som) ──
// Como não temos arquivos de som físicos, usamos vibração como diferenciador principal.
// O som é tocado no cliente (client-side) via AudioContext quando a notificação é recebida.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (_) {
    data = { title: 'Assistente Ark', body: event.data ? event.data.text() : '' }
  }

  const type = data.type || 'human_handoff'
  const vibrate = VIBRATION_BY_TYPE[type] || DEFAULT_VIBRATION

  const title = data.title || '👤 Cliente pediu atendimento humano'
  const options = {
    body: data.body || 'Uma conversa está esperando atendimento.',
    icon: '/arkiel-logo.png',
    badge: '/arkiel-logo.png',
    vibrate,
    tag: data.tag || `ark-${type}`,
    renotify: true,
    requireInteraction: type === 'human_handoff' || type === 'loop_detected',
    data: { url: data.url || '/admin/conversations', type },
    silent: false,
  }

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Notificar clients abertos pra tocar som via AudioContext
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NOTIFICATION_RECEIVED', eventType: type, sound: data.sound })
        })
      })
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/admin/conversations'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      for (const client of clientList) {
        if ('focus' in client) { client.focus(); client.navigate?.(targetUrl); return }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})

// Receber mensagens do client (pra salvar configurações de som no SW)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SAVE_SOUND_SETTINGS') {
    // Salvar no IndexedDB ou apenas ignorar — som é tocado pelo client
  }
})
