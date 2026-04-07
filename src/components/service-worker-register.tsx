"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` so Web Push and `showNotification` work after subscribe.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* non-fatal */
    });
  }, []);
  return null;
}
