/* Calculadora Comercial VE · Grupo FERSE · SW v3.9 */
const CACHE_NAME = 'calcve-v3.9'; // <--- CAMBIADO A v3.9
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.min.js',
  './manifest.json',
  './icon.png',
  './screenshot1.png',
  './logogrupoferse.png',
  './ads.txt'
];
const FONT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(CORE_ASSETS).then(() => cache.addAll(FONT_ASSETS).catch(() => {}))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

// Permitir que la app fuerce skipWaiting desde el banner
self.addEventListener('message', (e) => {
  if (e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Navegación: network-first con fallback a index cacheado
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // API BCV: network-first, sin cachear (para no servir tasas viejas como "nuevas")
  if (url.hostname === 've.dolarapi.com') {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Google AdSense / Analytics: dejar pasar sin cachear
  if (url.hostname.includes('googlesyndication') || url.hostname.includes('google-analytics') ||
      url.hostname.includes('doubleclick') || url.hostname.includes('googletagmanager')) {
    return;
  }

  // Estáticos propios y fuentes: cache-first con revalidación en segundo plano
  if (url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});