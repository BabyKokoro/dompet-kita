/* Service worker Dompet Kita: aplikasi tetap bisa dibuka tanpa internet */
const VERSI = "dompet-kita-7d7dc4cdcb";
const INTI = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSI).then(c => c.addAll(INTI))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI && k !== "dompet-kita-bagikan").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  /* gambar yang dibagikan dari aplikasi lain (Android) disimpan sebentar, lalu aplikasi dibuka */
  if (r.method === "POST" && new URL(r.url).pathname.endsWith("/bagikan")){
    e.respondWith((async () => {
      try {
        const fd = await r.formData(), c = await caches.open("dompet-kita-bagikan");
        await c.delete("foto"); await c.delete("teks");
        const f = fd.getAll("foto").find(x => x && x.size);
        if (f) await c.put("foto", new Response(f, {headers:{"content-type":f.type || "image/jpeg"}}));
        const teks = ["title", "text", "url"].map(k => fd.get(k) || "").filter(Boolean).join("\n");
        if (teks) await c.put("teks", new Response(teks));
      } catch(err){}
      return Response.redirect("./?aksi=bagikan", 303);
    })());
    return;
  }
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !font) return;
  if (url.searchParams.has("cekversi")) return; /* cek versi baru: selalu langsung ke jaringan */
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

/* notifikasi pengingat tagihan dari server (aplikasi boleh tertutup) */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err){ d = {isi:e.data ? e.data.text() : ""}; }
  const obrolan = String(d.tag || "").startsWith("dompet-kita-obrolan");
  e.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then(ws => {
    if (obrolan){
      const tampil = ws.filter(w => w.visibilityState === "visible");
      ws.forEach(w => w.postMessage({jenis:"obrolan-baru"}));
      if (tampil.length) return;
    }
    return self.registration.showNotification(d.judul || "Dompet Kita", {
      body:d.isi || "Ada pengingat baru dari Dompet Kita.", icon:"icons/icon-192.png", badge:"icons/icon-192.png",
      tag:d.tag || "dompet-kita", renotify:true, data:{url:obrolan ? "./?aksi=obrolan" : "./?aksi=tagihan", jenis:obrolan ? "obrolan" : "tagihan"}});
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then(ws => {
    const jenis = (e.notification.data && e.notification.data.jenis) || "tagihan";
    for (const w of ws){ if (w.url.startsWith(self.registration.scope) && "focus" in w){ w.postMessage({jenis:"buka", aksi:jenis}); return w.focus(); } }
    return self.clients.openWindow(url);
  }));
});
