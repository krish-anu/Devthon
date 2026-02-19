/* ─── Trash2Treasure Push Notification Service Worker ─── */

self.addEventListener("install", (evt) => {
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(self.clients.claim());
});

/* ─── Handle incoming push events from the server ─── */
self.addEventListener("push", function (event) {
  const data = event.data
    ? event.data.json()
    : { title: "Trash2Treasure", body: "You have a new notification" };

  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.data?.bookingId || "general",
    renotify: true,
    data: data.data || {},
    actions: data.data?.bookingId
      ? [{ action: "view", title: "View Booking" }]
      : [],
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

/* ─── Handle notification click → open the correct page ─── */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/users/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If an existing window is open, navigate it
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(url);
      }),
  );
});

/* ─── Handle test notifications sent via postMessage ─── */
self.addEventListener("message", (event) => {
  try {
    const data = event.data || {};
    if (data && data.type === "TEST_NOTIFICATION") {
      self.registration.showNotification(data.title || "Test", {
        body: data.body || "",
        icon: "/favicon.svg",
      });
    }
  } catch (e) {
    // ignore
  }
});

