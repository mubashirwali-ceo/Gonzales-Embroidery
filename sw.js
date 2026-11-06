// Tiny service worker: lets the admin panel show phone/desktop notifications and opens it when tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.includes("admin.html") && "focus" in c) return c.focus(); }
    return self.clients.openWindow("admin.html");
  }));
});
