/* Aura Cycles — service worker (app-shell + offline). */
const CACHE = 'aura-cycles-v31';
const ASSETS = [
  '/',
  '/app',
  '/how-it-works',
  '/about',
  '/contact',
  '/static/style.css',
  '/static/landing.css',
  '/static/pages.css',
  '/static/app.js',
  '/static/fonts/playfair.css',
  '/static/fonts/fonts.css',
  '/static/fonts/EBGaramond-Regular.ttf',
  '/static/fonts/EBGaramond-Bold.ttf',
  '/static/img/cosmic-bg.jpg',
  '/static/img/wordmark.png',
  '/static/img/monogram.png',
  '/static/img/logo-header.jpg',
  '/manifest.webmanifest',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Never intercept API calls or the .ics download route. iOS Safari cannot
  // complete a file download served through a service worker ("Safari cannot
  // download this file"), so the calendar export must hit the network directly.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ics/')) return;

  // Navigations: network-first, fall back to cached app shell when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets: stale-while-revalidate (instant from cache, fresh on next load).
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
