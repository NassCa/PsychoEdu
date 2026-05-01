/**
 * Service Worker – PsychoEdukations-Bibliothek
 * Strategie: Cache-First für alle Assets, Network-First für HTML
 * Offline-Support: vollständig (Single-File-App)
 */

const CACHE_NAME = 'psychoedukation-v1';
const OFFLINE_URL = './index.html';

// Alle zu cachenden Assets
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Google Fonts (falls geladen)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap'
];

// ====== INSTALL ======
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Kritische Assets precachen
      return cache.addAll([OFFLINE_URL, './manifest.json']).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// ====== ACTIVATE ======
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ====== FETCH ======
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur GET-Requests cachen
  if (request.method !== 'GET') return;

  // Externe Requests (Fonts, CDN) – Cache-First
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // Haupt-HTML – Network-First (frische Updates), Fallback auf Cache
  if (request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(OFFLINE_URL).then(cached => cached || new Response('<h1>Offline</h1>', {
          headers: { 'Content-Type': 'text/html' }
        }))
      )
    );
    return;
  }

  // Alle anderen Assets – Cache-First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => new Response('', { status: 408 }));
    })
  );
});

// ====== BACKGROUND SYNC (Update-Notification) ======
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
