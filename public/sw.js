const CACHE = 'hq-v3'
const OFFLINE_URLS = ['/', '/dashboard', '/login']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  )
})
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
})

// ── 푸시 알림 수신 ──────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: '알림', body: e.data.text() } }

  const { title = '본부관리시스템', body = '', url = '/dashboard', icon = '/icons/icon-192.png' } = payload

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-72.png',
      tag: 'hq-push',
      renotify: true,
      data: { url },
    })
  )
})

// ── 알림 클릭 → 해당 페이지 열기 ──────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/dashboard'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
