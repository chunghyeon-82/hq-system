const CACHE = 'hq-v6'
const OFFLINE_URLS = ['/', '/login']

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
  const url = e.request.url
  if (e.request.method !== 'GET') return
  if (url.includes('/api/')) return
  if (!url.includes('hq-system-jade.vercel.app') && !url.startsWith('/')) return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: '알림', body: e.data.text() } }
  const {
    title = '본부관리시스템',
    body = '',
    url = '/',
    icon = '/icons/icon-192.png',
    alertType = 'vibrate_sound'
  } = payload

  // alertType이 'off'이면 알림 표시 안함
  if (alertType === 'off') return

  // 진동 패턴
  const vibrate = alertType === 'vibrate' ? [200, 100, 200] :
                  alertType === 'vibrate_sound' ? [200, 100, 200] : []

  // 소리 (silent: true면 소리 없음)
  const silent = alertType === 'vibrate'

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-72.png',
      tag: 'hq-push',
      renotify: true,
      vibrate,
      silent,
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
