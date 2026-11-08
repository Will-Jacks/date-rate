/* Date Rate — service worker
 * 1. Notificações push (inclusive com o app fechado)
 * 2. Modo offline básico: telas e fotos já vistas continuam abrindo sem internet
 */

const VERSION = "v1";
const PAGES = `dr-pages-${VERSION}`;
const STATIC = `dr-static-${VERSION}`;
const IMAGES = `dr-images-${VERSION}`;
const MAX_IMAGES = 300;

// Em desenvolvimento (localhost) não guardamos nada em cache, para não atrapalhar.
const CACHE_ENABLED = self.location.hostname !== "localhost" && self.location.hostname !== "127.0.0.1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, STATIC, IMAGES];
      for (const key of await caches.keys()) {
        if (key.startsWith("dr-") && !keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/* ------------------------------------------------------------------ push */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Date Rate";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa-192.png",
      badge: "/pwa-badge.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

/* --------------------------------------------------------------- offline */

async function trimImages() {
  const cache = await caches.open(IMAGES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  if (!CACHE_ENABLED) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fotos do Supabase: a URL assinada muda a cada hora, então a chave do
  // cache ignora o token (?token=...). Primeiro o cache, depois a rede.
  if (url.pathname.includes("/storage/v1/object/sign/")) {
    const key = url.origin + url.pathname;
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGES);
        const hit = await cache.match(key);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(key, res.clone());
          trimImages();
        }
        return res;
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Arquivos do build (têm hash no nome): cache primeiro
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Telas: rede primeiro; sem internet, a última versão salva (ou o feed)
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return (await cache.match(req)) || (await cache.match("/")) || Response.error();
        }
      })(),
    );
  }
});
