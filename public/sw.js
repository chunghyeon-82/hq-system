const CACHE_NAME = 'hq-system-v1'
const urlsToCache = ['/', '/dashboard', '/businesses', '/login']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)))
})

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  )
})
