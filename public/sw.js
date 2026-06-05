// Service Worker for Web Push notifications
// Serenity Dashboard

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Serenity", body: event.data.text() };
  }

  const title   = payload.title   ?? "Serenity";
  const options = {
    body:    payload.body    ?? "",
    icon:    "/icon-192.png",
    badge:   "/icon-96.png",
    tag:     payload.channelName ?? "serenity",   // 同频道通知合并显示
    renotify: true,
    data:    { url: payload.url ?? "/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 如果已有窗口打开，直接聚焦并跳转
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
