/* IPPIS Staff Recognition — service worker */
const VERSION = 'v1'
const STATIC_CACHE = `ippis-static-${VERSION}`
const RUNTIME_CACHE = `ippis-runtime-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API calls: always go to the network so vote data is live; no offline fallback
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network first, fall back to the offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match(OFFLINE_URL)),
        ),
    )
    return
  }

  // Build assets & images: cache first, then network (immutable content)
  if (url.pathname.startsWith('/_next/static') || /\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
