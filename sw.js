// Service Worker — Waktu Sholat PWA (Fixed Audio)
const CACHE_NAME = 'waktu-sholat-v2'; // Naikkan versi karena ada perubahan logika
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Saran: Download adhan.mp3 dan simpan lokal agar lebih stabil
  // '/audio/adhan.mp3', 
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. KHUSUS AUDIO: Bypass Service Worker atau tangani secara terpisah
  // File audio sering gagal di SW karena masalah "Range Requests"
  if (url.pathname.endsWith('.mp3') || url.hostname.includes('media.sd.ma') || url.hostname.includes('islamic.network')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. API calls: network only, no cache
  if (url.hostname === 'api.aladhan.com' || url.hostname === 'nominatim.openstreetmap.org') {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ error: 'offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // 3. Static assets (Fonts): cache first
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

  // 4. App shell: network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
  );
});

// Push & Notification Logic tetap sama...
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Waktu sholat telah tiba',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'prayer-time',
    renotify: true,
    data: { url: '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Waktu Sholat', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
