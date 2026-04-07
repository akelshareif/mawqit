/* global self */

self.addEventListener("push", (event) => {
  let root = {};
  try {
    root = event.data ? event.data.json() : {};
  } catch {
    /* ignore */
  }
  const title = root.title || "Mawqit";
  const body = root.body || "Prayer reminder";
  const d = root.data || {};
  const url = d.url || "/";
  const tag = typeof d.tag === "string" && d.tag ? d.tag : undefined;
  const actions = [];
  if (d.kind === "prayer" && d.ackUrl && d.sessionId && d.prayerName && d.prayerDateYmd) {
    actions.push({ action: "ack", title: "I prayed" });
    actions.push({ action: "open_session", title: "Open session" });
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { ...d, url },
      actions,
      ...(tag ? { tag } : {}),
    }),
  );
});

function postAck(d) {
  if (!d.ackUrl || !d.prayerName || !d.prayerDateYmd) {
    return Promise.resolve();
  }
  const fullAck = new URL(d.ackUrl, self.location.origin).href;
  return fetch(fullAck, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prayerName: d.prayerName,
      prayerDate: d.prayerDateYmd,
      channel: "browser",
      deviceKey: d.deviceKey || "",
    }),
  }).catch(() => {});
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.url || "/";
  const action = event.action;

  if (action === "ack") {
    event.waitUntil(postAck(d));
    return;
  }

  event.waitUntil(
    (async () => {
      await postAck(d);
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
