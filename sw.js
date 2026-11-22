/* Familieski 2027 — service worker
   Gemmer rejseplanen (index.html) til offline brug.
   Siden hentes altid fra nettet først, så en ny rejseplan erstatter den gamle,
   så snart der er forbindelse. Uden net vises den senest gemte version.
   Hæv VERSION, når sw.js selv ændres. */
const VERSION = "familieski-v2-2026-11-22";
const FONTS = "familieski-fonts-v1";
const SCOPE = self.registration.scope;              // fx https://friisnaes.github.io/familieski/
const HOME = new URL("./", SCOPE).href;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => fetch(HOME, { cache: "no-store" }).then(r => { if (r.ok) return c.put(HOME, r); }))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(req, url){
  return req.mode === "navigate" || (url.origin === location.origin && (url.href === HOME || url.pathname.endsWith("/index.html")));
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Rejseplanen: net først, gem kopi, fald tilbage til den gemte
  if (url.href.startsWith(SCOPE) && isPage(req, url)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then(res => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(HOME, copy));
          }
          return res;
        })
        .catch(() => caches.open(VERSION).then(c => c.match(HOME)).then(r => r || new Response(
          "<!doctype html><meta charset=utf-8><title>Offline</title><p style='font:18px system-ui;padding:24px'>Ingen forbindelse, og rejseplanen er ikke gemt på denne enhed endnu.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 })))
    );
    return;
  }

  // Skrifter: brug gemt kopi, opdatér i baggrunden
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONTS).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
  // Alt andet (hotellets billeder, eksterne links) går direkte til nettet
});
