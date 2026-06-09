// Service worker minimal pour l'installabilité PWA (HALO Pro).
// Stratégie : RÉSEAU D'ABORD, avec repli sur le cache uniquement hors-ligne, et
// jamais de mise en cache des pages authentifiées / données dynamiques (évite le
// contenu périmé). On ne précache que l'icône d'app.
const CACHE = "halo-pro-v1";
const PRECACHE = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // On ne gère que les GET de même origine ; le reste passe au réseau normalement.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).catch(() => caches.match(req)) // réseau d'abord ; cache seulement si hors-ligne
  );
});
