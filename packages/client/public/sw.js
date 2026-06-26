/* global self, URL, caches, fetch, Response */

const CACHE_NAME = "echoflowai-v1";
const STATIC_ASSETS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (/\.(js|css|png|jpg|svg|ico|woff2?|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json?.() || {};
  } catch {
    data = {};
  }

  const notifyOpenClients = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "buildingai:notification-push" });
      });
    });

  const title = data.title || "EchoFlowAI";
  const options = {
    body: data.body || "任务状态已更新",
    icon: data.icon || "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: {
      url: data.url || "/",
      notificationId: data.notificationId,
    },
  };

  event.waitUntil(
    Promise.all([notifyOpenClients, self.registration.showNotification(title, options)]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = self.location.origin + "/";
  try {
    const rawUrl = String(event.notification.data?.url || "/");
    const parsedUrl = new URL(rawUrl, self.location.origin);
    if (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      parsedUrl.origin === self.location.origin &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      !rawUrl.trim().startsWith("//")
    ) {
      targetUrl = parsedUrl.href;
    }
  } catch {
    targetUrl = self.location.origin + "/";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients.find((item) => item.url === targetUrl);
      if (client) return client.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
