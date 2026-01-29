self.addEventListener("install", (evt) => {
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  self.clients.claim();
});

self.addEventListener("push", function (event) {
  const data = event.data
    ? event.data.json()
    : { title: "Notification", body: "" };
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body }),
  );
});

self.addEventListener("message", (event) => {
  try {
    const data = event.data || {};
    if (data && data.type === "TEST_NOTIFICATION") {
      self.registration.showNotification(data.title || "Test", {
        body: data.body || "",
      });
    }
  } catch (e) {
    // ignore
  }
});
