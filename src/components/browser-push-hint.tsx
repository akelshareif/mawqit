"use client";

import { Button } from "@/components/ui/button";
import { urlBase64ToUint8Array } from "@/lib/push-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  sessionId: string;
  /**
   * When set (e.g. on setup/settings), runs first so the session is saved with
   * browser notifications enabled before the push API accepts a subscription.
   */
  prepareSession?: () => Promise<boolean>;
};

export function BrowserPushHint({
  sessionId,
  prepareSession,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function enablePush() {
    setError(null);
    setPending(true);
    try {
      if (prepareSession) {
        const ok = await prepareSession();
        if (!ok) {
          return;
        }
      }

      if (typeof window === "undefined" || !("Notification" in window)) {
        setError("Notifications are not supported in this browser.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setError("Permission was not granted. Allow notifications for this site and try again.");
        return;
      }

      const keyRes = await fetch("/api/push/vapid-public-key");
      const keyJson = (await keyRes.json()) as { publicKey?: string; error?: string };
      if (!keyRes.ok || !keyJson.publicKey) {
        setError(
          keyJson.error ??
            "VAPID keys are not configured. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY (and VAPID_PRIVATE_KEY for real sends) to your environment.",
        );
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyJson.publicKey,
        ) as BufferSource,
      });

      const subscription = sub.toJSON();
      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        setError("Could not read subscription keys.");
        return;
      }

      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
        }),
      });
      const saveJson = (await save.json().catch(() => ({}))) as { error?: string };
      if (!save.ok) {
        setError(saveJson.error ?? "Could not save subscription.");
        return;
      }

      setDone(true);
      window.setTimeout(() => {
        router.refresh();
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-foreground"
      >
        <p className="font-medium">Browser notifications are ready</p>
        <p className="mt-1 text-muted-foreground">
          You&apos;ll get prayer alerts on this device when each prayer time is
          due (handled on the server on a short schedule).
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm text-foreground"
    >
      <p className="font-medium">Finish enabling browser notifications</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">
        Allow notifications and subscribe this device so Mawqit can send Web Push reminders when
        prayer times arrive.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-3 h-10 rounded-xl"
        disabled={pending}
        onClick={() => void enablePush()}
      >
        {pending ? "Working…" : "Enable notifications on this device"}
      </Button>
    </div>
  );
}
