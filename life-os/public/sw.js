/* Life OS — service worker
 * - Cache de recursos estáticos (cache-first) e páginas (network-first com fallback).
 * - Recepção de Web Push e clique em notificações.
 * Nunca cacheia respostas de API/Supabase nem requisições não-GET.
 */
const VERSION = "v1";
const STATIC_CACHE = `lifeos-static-${VERSION}`;
const PAGE_CACHE = `lifeos-pages-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("lifeos-") && !k.endsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:png|svg|ico|woff2?|css|js)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fontes externas etc. passam direto
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(request, copy)); } return res; })),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Páginas autenticadas mudam a cada requisição: guardamos só como fallback offline.
          if (res.ok) { const copy = res.clone(); caches.open(PAGE_CACHE).then((c) => c.put(request, copy)); }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Life OS", body: "", url: "/dashboard", tag: undefined };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url },
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) { client.navigate(url); return client.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // O cliente re-assina ao abrir o app (ver push-manager). Nada a fazer aqui sem a chave VAPID.
  event.waitUntil(Promise.resolve());
});
