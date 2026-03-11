// ═══════════════════════════════════════════════════════════
//  MyCut PWA — Service Worker
//  Стратегия: Cache-First для shell, Network-First для шрифтов
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'mycut-v3';

// Всё, что нужно закешировать при первой установке
const PRECACHE_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL: кешируем shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Активируем сразу, не ждём закрытия старых вкладок
  self.skipWaiting();
});

// ── ACTIVATE: чистим старые кеши ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Берём контроль над всеми открытыми вкладками сразу
  self.clients.claim();
});

// ── FETCH: Cache-First для всего локального ─────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем chrome-extension и нелокальные запросы к API
  if (!url.protocol.startsWith('http')) return;

  // Шрифты Google — Network-First с fallback из кеша
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Всё остальное — Cache-First (index.html, manifest, иконки)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // Нет в кеше — тянем из сети и сохраняем
      return fetch(request).then(response => {
        // Не кешируем плохие ответы и non-GET
        if (!response || response.status !== 200 || request.method !== 'GET') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
