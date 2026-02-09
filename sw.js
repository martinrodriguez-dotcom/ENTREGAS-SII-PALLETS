const CACHE_NAME = 'sii-pallets-v2';

// Archivos básicos para que la app no quede en blanco
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Usamos una versión más resiliente que no falla si falta un archivo opcional
        console.log('Abriendo caché v2');
        return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
