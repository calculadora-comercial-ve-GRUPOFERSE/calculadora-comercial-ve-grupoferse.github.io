const CACHE_NAME = 'calcve-v2.5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './screenshot1.png',
  './icon.png'
];

// Instalación y precaché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación y limpieza de versiones antiguas de caché
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network First para HTML y Cache First para estáticos
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});