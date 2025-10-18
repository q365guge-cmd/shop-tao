const CACHE_NAME = 'shop-tao-cache-v1';
const PRECACHE_URLS = [
  '.', // allow start_url caching
  'index.html',
  'manifest.json'
];

// Placeholder SVG for images when offline
const IMAGE_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" fill="#9ca3af" font-family="Arial" font-size="28" text-anchor="middle" dominant-baseline="middle">Ảnh tạm (offline)</text></svg>`
);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      // cleanup old caches if any
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // navigation requests -> serve cached index.html (App Shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then(resp => resp || fetch(req).catch(()=>caches.match('index.html')))
    );
    return;
  }

  // handle same-origin resources (css/js - though our app is single file)
  if (req.destination === 'script' || req.destination === 'style' || req.destination === 'document') {
    event.respondWith(caches.match(req).then(r=>r || fetch(req).then(fetchRes => { caches.open(CACHE_NAME).then(c=>c.put(req, fetchRes.clone())); return fetchRes; }).catch(()=>caches.match('index.html'))));
    return;
  }

  // images: try cache -> network -> placeholder
  if (req.destination === 'image') {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(netRes => {
          // optionally cache it for later
          caches.open(CACHE_NAME).then(c=>c.put(req, netRes.clone()));
          return netRes;
        }).catch(()=> {
          return fetch(IMAGE_PLACEHOLDER);
        });
      })
    );
    return;
  }

  // default: try cache first, then network
  event.respondWith(
    caches.match(req).then(resp => resp || fetch(req).then(r => { caches.open(CACHE_NAME).then(c=>c.put(req, r.clone())); return r; }))
  );
});
