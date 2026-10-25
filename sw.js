// Offline-Funktion: Die Dateien des Spiels werden beim ersten Besuch gespeichert.
// Nach einer Änderung an den Dateien die Versionsnummer erhöhen (z. B. v2), damit Handys die neue Fassung holen.
const VERSION = "kakoomay-v2";
const FILES = [
  "./", "./index.html", "./config.js", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./fonts/baloo-2-600.woff2", "./fonts/baloo-2-800.woff2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Dateien dieser Seite: erst aus dem Speicher (schnell, offline), im Hintergrund aktualisieren.
// Anfragen an andere Adressen (zentrale Bestenliste) werden nicht angefasst.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
