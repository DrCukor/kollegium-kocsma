const CACHE_NAME = "kollegiumi-kocsma-v1";

const FILES_TO_CACHE = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// --- Telepítéskor: gyorsítótárba tesszük a fő fájlokat ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// --- Aktiváláskor: kitakarítjuk a régi verziójú gyorsítótárakat ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// --- Kérések kiszolgálása: előbb a cache-ből, ha nincs ott, a hálózatról ---
self.addEventListener("fetch", (event) => {
  // A Supabase-hívásokat sose cache-eljük, mindig friss adat kell
  if (event.request.url.includes("supabase.co")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});