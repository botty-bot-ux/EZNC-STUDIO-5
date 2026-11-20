/*
 * Офлайн-оболочка PWA. Все пути резолвятся относительно самого sw.js, поэтому
 * работает и в корне, и на подпути GitHub Pages (/EZNC-STUDIO-5/).
 *
 * Стратегия:
 *   • навигация (index.html) — сеть первой: свежий билд подхватывается сразу,
 *     при отсутствии сети отдаём кэшированный index.html;
 *   • хешированные ассеты — кэш первой (они иммутабельны), с добором из сети.
 *
 * VERSION в именах кэшей: новый деплой с другим VERSION вытесняет старые кэши
 * на этапе activate.
 */
const VERSION = 'v5';
const SHELL_CACHE = `eznc-shell-${VERSION}`;
const ASSET_CACHE = `eznc-assets-${VERSION}`;

// Каталог, в котором лежит sw.js (…/ или …/EZNC-STUDIO-5/).
const BASE = new URL('./', self.location).href;
const BASE_PATHNAME = new URL(BASE).pathname;
const ASSETS_PREFIX = `${BASE_PATHNAME}assets/`;
const INDEX_URLS = [BASE, `${BASE}index.html`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(INDEX_URLS.concat(`${BASE}manifest.json`)))
      .catch(() => {
        /* офлайн-переустановка не должна ронять install */
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // внешние запросы не трогаем

  // Навигация: сеть первой, при отказе — кэшированный index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(`${BASE}index.html`, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(`${BASE}index.html`).then((r) => r || caches.match(BASE))
        )
    );
    return;
  }

  // Только хешированные бандлы сборки (/assets/): кэш первой, добор из сети.
  // Dev-модули (/src/, /@vite/, /node_modules/) никогда не кэшируются.
  if (url.pathname.startsWith(ASSETS_PREFIX)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
