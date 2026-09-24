const CACHE_NAME = "ricodelico-caja-v3.3";
const FILES_TO_CACHE = [
  "index.html", "app.js", "voice.js", "productos.js",
  "admin-productos.js", "supabase.js", "styles.css", "manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes('supabase.co') ||
      event.request.url.includes('cdn.jsdelivr.net') ||
      event.request.url.includes('dolarapi.com') ||
      event.request.url.includes('criptoya.com') ||
      event.request.url.includes('fonts.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
