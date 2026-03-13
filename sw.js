// Service Worker — Waktu Sholat PWA v3 (Audio + Compass)
const CACHE_NAME = 'waktu-sholat-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/audio/azan.mp3',   // ← file MP3 yang diupload ke GitHub
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        STATIC_ASSETS.filter(u => !u.endsWith('.mp3'))  // jangan cache MP3 saat install (opsional)
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_NAME + '-fonts')
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. MP3 Azan — Network first, cache sebagai fallback offline
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. API — Network only (tidak di-cache)
  if (url.hostname === 'api.aladhan.com' || url.hostname === 'nominatim.openstreetmap.org') {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ error: 'offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // 3. Font Google — Cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME + '-fonts').then(c => c.put(event.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // 4. App shell — Network first, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() =>
        caches.match(event.request)
          .then(cached => cached || caches.match('/index.html'))
      )
  );
});

// Push notification
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Waktu Sholat', {
      body:    data.body || 'Waktu sholat telah tiba',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      vibrate: [200, 100, 200, 100, 200],
      tag:     'prayer-time',
      renotify: true,
      data:    { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
