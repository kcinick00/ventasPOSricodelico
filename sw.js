const CACHE_NAME = "ricodelico-caja-v3.8";
const FILES_TO_CACHE = [
  "index.html", "app.js", "voice.js", "productos.js",
  "admin-productos.js", "supabase.js", "auth-ui.js", "styles.css", "manifest.json"
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
  
  // Red primero (siempre código actualizado); caché solo si no hay internet
  event.respondWith(
    fetch(event.request).then((resp) => {
      if (resp && resp.ok && event.request.method === 'GET') {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copia));
      }
      return resp;
    }).catch(() => caches.match(event.request))
  );
});
