// Service worker de Tasca: abre sin conexión con lo último que tenía y se actualiza sola.
const CACHE = "tasca-v2";
const SHELL = ["./", "./index.html", "./styles.css?v=1", "./src/main.js?v=1", "./icon.svg", "./icon-192.png", "./manifest.webmanifest", "../config.js", "../capacitor-core.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("tasca-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Red primero para la app (así siempre está al día); caché si no hay conexión. Firebase (gstatic) se guarda la primera vez.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/version.json")) return; // nunca de la caché: es lo que avisa de las versiones nuevas
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))));
  } else if (url.hostname === "www.gstatic.com") {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    })));
  }
});
// Al tocar un aviso: abrir (o enfocar) la app y la tarea
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const tarea = e.notification.data?.tarea;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.includes("/tareas/"));
    if (c) { c.focus(); if (tarea) c.postMessage({ tarea }); return; }
    return self.clients.openWindow("./" + (tarea ? "?tarea=" + encodeURIComponent(tarea) : "") + "#/hoy");
  }));
});
