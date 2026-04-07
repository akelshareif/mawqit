import { DEBUG_PUSH_NOTIFICATION_TAG } from "@/lib/debug-notification-tag";

export type ShowDebugNotificationResult = {
  ok: boolean;
  permission: NotificationPermission | "unsupported";
  detail?: string;
};

/**
 * Shows a visible OS/browser notification from a user gesture (debug buttons).
 * Tries page-level `Notification` first (often works when SW isn’t active yet),
 * then `ServiceWorkerRegistration.showNotification` after register + ready.
 */
export async function showDebugNotificationBanner(
  title: string,
  body: string,
): Promise<ShowDebugNotificationResult> {
  const tag = DEBUG_PUSH_NOTIFICATION_TAG;

  if (typeof window === "undefined") {
    return { ok: false, permission: "unsupported", detail: "No window" };
  }

  if (typeof Notification === "undefined") {
    return {
      ok: false,
      permission: "unsupported",
      detail: "This browser has no Notification API.",
    };
  }

  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm === "denied") {
    return {
      ok: false,
      permission: "denied",
      detail:
        "Notifications are blocked for this site. Use the lock icon in the address bar (or Site settings) and allow notifications.",
    };
  }

  // 1) Page-level — does not require an active service worker (common gap when getRegistration() was null).
  try {
    new Notification(title, { body, tag });
    return { ok: true, permission: "granted" };
  } catch {
    /* try SW */
  }

  if (!("serviceWorker" in navigator)) {
    return {
      ok: false,
      permission: "granted",
      detail: "Notification() failed and service workers are not supported.",
    };
  }

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, tag });
    return { ok: true, permission: "granted" };
  } catch (e) {
    return {
      ok: false,
      permission: "granted",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
