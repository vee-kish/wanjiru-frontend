/* ============================================================
   sw.js — Service Worker for Wanjiru Bakery PWA
   - Pre-caches app shell
   - HTML/static: Network-First with Cache Fallback
   - /api/: Network-Only (no caching of requests/responses)
   - Offline fallback: /offline.html
   ============================================================ */

const CACHE = "wanjiru-bakery-v1";

const PRECACHE = [
  "/index.html",
  "/dashboard.html",
  "/orders.html",
  "/new-order.html",
  "/suppliers.html",
  "/offline.html",
  "/css/style.css",
  "/css/responsive.css",
  "/js/api.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/orders.js",
  "/js/suppliers.js",
  "/js/pwa.js",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API calls: Network-Only (never cache request/response data).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: "offline", message: "Network unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )));
    return;
  }

  // HTML navigation requests: Network-First, fall back to cache, then offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/offline.html");
        })
    );
    return;
  }

  // Static assets: Stale-While-Revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
