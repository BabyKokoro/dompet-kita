/* Service worker Dompet Kita: aplikasi tetap bisa dibuka tanpa internet */
const VERSI = "dompet-kita-e0e7604c04";
const INTI = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSI).then(c => c.addAll(INTI))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  if (r.mode === "navigate"){
    /* halaman: ambil versi terbaru dulu, kalau offline pakai simpanan */
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(VERSI).then(x => x.put("index.html", c)); return res; })
      .catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const ambil = fetch(r).then(res => { if (res.ok || res.type === "opaque"){ const c = res.clone(); caches.open(VERSI).then(x => x.put(r, c)); } return res; }).catch(() => hit);
    return hit || ambil;
  }));
});
