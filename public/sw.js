// Flight Ops — lightweight service worker for the static web build.
//
// Strategy:
//  - navigations (HTML): network-first with a cached "/" fallback, so deep
//    links and refreshes keep working when the network drops;
//  - same-origin static assets: cache-first, filling the cache on first
//    sight, so the game and Aero Lab (both fully client-side) keep running
//    offline after the first load;
//  - everything else (cross-origin, non-GET): untouched.
//
// The cache is versioned; on activate, stale versions are purged.

const CACHE = 'flightops-v1';
const SHELL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never proxy cross-origin traffic

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(SHELL).then((cached) => cached || caches.match(request))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
    )
  );
});
