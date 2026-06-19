/* global self, URL */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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

  const title = data.title || "BuildingAI";
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
