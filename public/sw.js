// Service Worker do Assistente Ark — recebe pushes e mostra notificação
// com som + vibração mesmo com o site fechado (após instalado/permitido).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (_) {
    data = { title: 'Assistente Ark', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || '👤 Cliente pediu atendimento humano'
  const options = {
    body: data.body || 'Uma conversa está esperando atendimento.',
    icon: '/arkiel-logo.png',
    badge: '/arkiel-logo.png',
    vibrate: [300, 150, 300, 150, 300],
    tag: data.tag || 'ark-notification',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/admin/conversations' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
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
