// Offline-Funktion: Die Dateien des Spiels werden beim ersten Besuch gespeichert.
// Die Versionsnummer steht nur in version.js. Wird sie erhöht, holt sich jedes Gerät beim nächsten Öffnen die neue Fassung.
importScripts("version.js");
const VERSION = "kakoomay-" + self.KAKOOMAY_VERSION.v;
const FILES = [
  "./", "./index.html", "./version.js", "./config.js", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./fonts/baloo-2-600.woff2", "./fonts/baloo-2-800.woff2"
];

self.addEventListener("install", (e) => {
  // cache: "reload" holt frische Dateien vom Server und nicht aus dem HTTP-Zwischenspeicher des Browsers
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Dateien dieser Seite: erst aus dem Speicher (schnell, offline), im Hintergrund prüfen und aktualisieren.
// Anfragen an andere Adressen (zentrale Bestenliste) und die Update-Prüfung (?check) gehen direkt ins Netz.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.searchParams.has("check")) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req, { cache: "no-cache" }).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
