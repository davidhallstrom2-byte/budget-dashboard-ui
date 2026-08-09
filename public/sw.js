const CACHE_NAME = "budget-dashboard-shell-v3-v116-20260806";
const APP_ROOT = "/budget-dashboard-fs/";

const shouldNeverCache = (url) =>
  url.pathname.endsWith(".php") ||
  url.pathname.endsWith(".webmanifest") ||
  url.pathname.endsWith("/manifest.json") ||
  url.pathname.endsWith("/sw.js") ||
  url.pathname.includes("/private-data/") ||
  url.pathname.includes("/uploads/") ||
  url.pathname.includes("/documents/") ||
  url.searchParams.has("action");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(APP_ROOT)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldNeverCache(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, copy));
          return response;
        })
        .catch(() => caches.match(APP_ROOT))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
