// Kéva — fonctionnement hors ligne.
// Stratégie : on sert toujours la copie locale (instantané, marche sans réseau),
// et on télécharge la nouvelle version en arrière-plan. Elle s'applique à l'ouverture suivante.
const CACHE = "keva-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices Google : en cache dès le premier chargement
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (err) { return new Response("", {status: 504}); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  const key = req.mode === "navigate" ? "./index.html" : req;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(key, {ignoreSearch: true});
    const update = fetch(req.mode === "navigate" ? new Request("./index.html", {cache: "no-cache"}) : new Request(req, {cache: "no-cache"}))
      .then(r => { if (r && r.ok) c.put(key, r.clone()); return r; })
      .catch(() => null);
    if (cached) { e.waitUntil(update); return cached; }
    const fresh = await update;
    return fresh || new Response("Hors ligne", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }));
});
