const CACHE_NAME = "aurafi-v3";
const PRECACHE = ["/", "/index.html", "/css/style.css", "/assets/hero-landscape.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const isDoc = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isDoc) {
    // Dokumen: utamakan jaringan agar rilis baru langsung terpasang;
    // cache hanya jadi penolong saat offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/index.html")))
    );
    return;
  }
  // Skrip & gaya (.js/.css): utamakan jaringan dengan revalidasi ETag
  // (cache: "no-cache") agar rilis baru tampil pada bukaan PERTAMA —
  // respons 304 tetap murah bila berkas belum berubah. Cache hanya jadi
  // penolong saat offline. (Sebelumnya aset ini cache-first, sehingga
  // update baru terlihat pada bukaan kedua.)
  const isScriptOrStyle = new URL(req.url).pathname.endsWith(".js") || new URL(req.url).pathname.endsWith(".css");
  if (isScriptOrStyle) {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }
  // Aset statis lain: sajikan cache dulu, segarkan di latar belakang.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
