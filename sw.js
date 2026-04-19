// Minimal service worker: network-first with cache fallback for same-origin GETs.
// Bump CACHE_VERSION together with APP_VERSION so old caches are purged on activate.
// Hosted as a plain static file (e.g. GitHub Pages) — no server code required.

const CACHE_VERSION = 'v1.4.0';
const CACHE_NAME = `mafia-${CACHE_VERSION}`;

// Resolve URLs relative to the worker's own location so subpath hosting works
// (e.g. https://user.github.io/Mafia/ where scope is /Mafia/).
const SHELL_URLS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
].map(p => new URL(p, self.location).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => { /* offline install — swallow */ }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(req));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (_err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // SPA fallback: any navigation request returns index.html from cache.
    if (request.mode === 'navigate') {
      const indexUrl = new URL('./index.html', self.location).toString();
      const fallback = await cache.match(indexUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}
