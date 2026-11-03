/* Service worker: gra działa offline.
 * Pliki gry: najpierw sieć (świeża wersja po każdym deployu), a gdy jej nie ma albo odpowiada dłużej niż 3 s, kopia z cache.
 * Fonty Google: najpierw cache (nie zmieniają się).
 * Nowy plik gry? Dopisz go do SHELL i podbij VERSION. */
const VERSION = "siatka-v2";
const SHELL = ["./", "index.html", "js/game.js", "js/audio.js", "js/tutorial.js", "engine/engine.js", "engine/sprites.js",
  "data/base.js", "data/cities.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const FONTS = "siatka-fonts";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req) {
  return caches.open(VERSION).then(cache => new Promise(resolve => {
    let done = false;
    const fallback = () => cache.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? cache.match("index.html") : null));
    const timer = setTimeout(() => fallback().then(r => { if (r && !done) { done = true; resolve(r); } }), 3000);
    fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      clearTimeout(timer); if (!done) { done = true; resolve(res); }
    }).catch(() => fallback().then(r => { clearTimeout(timer); if (!done) { done = true; resolve(r || Response.error()); } }));
  }));
}
function cacheFirst(req) {
  return caches.open(FONTS).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  })));
}

self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(cacheFirst(req));
});
