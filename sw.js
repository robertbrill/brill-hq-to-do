/* Brill HQ service worker — exists only to receive Web Push reminders and
 * open the app when one is tapped. It deliberately does NOT cache or intercept
 * any requests, so deploys are never served stale. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: "Reminder", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Reminder";
  const opts = {
    body: data.body || "",
    icon: "/favicon-512.png",
    badge: "/favicon-32.png",
    data: { url: data.url || "/?view=reminders", id: data.id || "" },
  };
  if (data.id) { opts.tag = String(data.id); opts.renotify = true; }
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          if ("navigate" in w) w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
