// Minimal service worker: caches the app shell so it launches instantly and
// satisfies PWA installability (over HTTPS). Never caches live endpoints.
const CACHE = "lapdeck-v1";
const SHELL = [
  "./", "./index.html", "./app.js", "./style.css", "./manifest.json",
  "./icons/app-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Live endpoints must always hit the network, never the cache.
  if (url.pathname.startsWith("/ws") || url.pathname.startsWith("/stream")) return;
  if (e.request.method !== "GET") return;
  // Network-first for the shell: always fetch fresh when online (so UI edits
  // show up without bumping the cache version), refresh the cache copy, and
  // fall back to cache only when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
