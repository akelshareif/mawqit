"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showDebugNotificationBanner } from "@/lib/show-debug-notification";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const QUICK_DUE_SECONDS = 15;

type Props = {
  sessionId: string;
  defaultEmail: string;
  /** Session has email enabled + saved address — outbound email simulate works. */
  emailReady: boolean;
  /** Browser notifications on + timezone + at least one push subscription. */
  browserPushReady: boolean;
  /** Why browser outbound is blocked (when `browserPushReady` is false). */
  browserPushBlockedReason: string | null;
  /** Saved email matches inbound lookup — STOP/HELP/ack simulation works. */
  inboundReady: boolean;
};

export function DebugSessionTools({
  sessionId,
  defaultEmail,
  emailReady,
  browserPushReady,
  browserPushBlockedReason,
  inboundReady,
}: Props) {
  const router = useRouter();
  const base = `/s/${sessionId}`;
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [from, setFrom] = useState(defaultEmail);
  const [inboundBody, setInboundBody] = useState("");

  async function simulateSend(
    target: "email" | "browser",
    dueInSeconds?: number,
  ) {
    setNotice(null);
    setPending(`send-${target}-${dueInSeconds ?? "plain"}`);
    try {
      const body: Record<string, unknown> = { channel: target };
      if (dueInSeconds != null) body.dueInSeconds = dueInSeconds;
      const res = await fetch(
        `/api/sessions/${sessionId}/debug/simulate-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        notification?: { title: string; body: string };
      };
      if (!res.ok) {
        setNotice(data.error ?? "Request failed");
        return;
      }
      let bannerHint = "";
      if (target === "browser" && data.notification) {
        const shown = await showDebugNotificationBanner(
          data.notification.title,
          data.notification.body,
        );
        if (!shown.ok) {
          bannerHint = ` On-screen alert: ${shown.detail ?? "failed"} — check site notification permission and macOS/System Settings → Notifications for your browser.`;
        } else {
          bannerHint =
            " If a second alert appears shortly after, that’s the Web Push delivery (same content).";
        }
      }
      setNotice(
        target === "email"
          ? "Email: check the message log below. With `RESEND_API_KEY` + `RESEND_FROM` set, mail is sent via Resend; otherwise it is log-only."
          : `Web Push sent.${bannerHint} Message log below.`,
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function sendInbound(presetBody?: string) {
    setNotice(null);
    const text =
      presetBody !== undefined ? presetBody : inboundBody;
    const trimmed = text.trim();
    if (!trimmed) {
      setNotice("Enter a body or use a preset.");
      return;
    }
    if (!from.trim()) {
      setNotice("From is required.");
      return;
    }
    if (presetBody !== undefined) {
      setInboundBody(presetBody);
    }
    setPending("inbound");
    try {
      const res = await fetch("/api/debug/simulate-inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          from,
          body: trimmed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        outcome?: string;
        error?: string;
      };
      if (!res.ok) {
        setNotice(data.error ?? "Request failed");
        return;
      }
      setNotice(
        presetBody !== undefined
          ? `Inbound (“${trimmed}”) — outcome: ${data.outcome ?? "ok"}.`
          : `Inbound handled (outcome: ${data.outcome ?? "ok"}).`,
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>How to use this page</CardTitle>
          <CardDescription>
            Outbound <strong>email</strong> is mock-only (log rows). Outbound{" "}
            <strong>browser</strong> sends real Web Push (VAPID) and immediately
            tries <code className="rounded bg-muted px-1 py-0.5 text-xs">new Notification()</code>{" "}
            plus service worker registration — so you get a banner even if the
            push service is slow or the tab was focused. On macOS, also allow
            banners for your browser in System Settings → Notifications, and
            disable Focus if alerts are suppressed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              <strong className="text-foreground">Outbound</strong> — fake a
              reminder email or a browser notification. Quick buttons use a “due
              in ~{QUICK_DUE_SECONDS}s” label so copy looks like a near-term
              prayer.
            </li>
            <li>
              <strong className="text-foreground">Inbound</strong> — pretend an
              email reply from your saved address (STOP / HELP / ack). The From
              field must match the email on your session.
            </li>
            <li>
              <strong className="text-foreground">Elsewhere</strong> —{" "}
              <Link
                href={`${base}/dashboard`}
                className="font-medium text-primary underline underline-offset-2"
              >
                Home
              </Link>{" "}
              (subscribe for browser tests),{" "}
              <Link
                href={`${base}/settings`}
                className="font-medium text-primary underline underline-offset-2"
              >
                Location &amp; Reminders
              </Link>{" "}
              (email, notifications, location).
            </li>
          </ul>
          {!emailReady ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
              Email outbound is disabled until you enable email and save an
              address in Location &amp; Reminders.
            </p>
          ) : null}
          {!browserPushReady && browserPushBlockedReason ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
              Browser notification outbound: {browserPushBlockedReason}
            </p>
          ) : null}
          {!inboundReady ? (
            <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-foreground">
              Inbound simulation needs a saved session email that matches From
              below.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbound — quick test (~{QUICK_DUE_SECONDS}s due)</CardTitle>
          <CardDescription>
            One tap each; message text pretends Fajr is due in about{" "}
            {QUICK_DUE_SECONDS} seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={busy || !emailReady}
            onClick={() => void simulateSend("email", QUICK_DUE_SECONDS)}
          >
            {pending === `send-email-${QUICK_DUE_SECONDS}` ? "Sending…" : "Email"}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={busy || !browserPushReady}
            onClick={() => void simulateSend("browser", QUICK_DUE_SECONDS)}
          >
            {pending === `send-browser-${QUICK_DUE_SECONDS}`
              ? "Sending…"
              : "Browser notification"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbound — plain test</CardTitle>
          <CardDescription>
            Same providers, generic subject/body (no “due in” wording).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-xl"
            disabled={busy || !emailReady}
            onClick={() => void simulateSend("email")}
          >
            {pending === "send-email-plain" ? "Sending…" : "Plain email"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-xl"
            disabled={busy || !browserPushReady}
            onClick={() => void simulateSend("browser")}
          >
            {pending === "send-browser-plain" ? "Sending…" : "Plain browser notification"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inbound email (replies)</CardTitle>
          <CardDescription>
            Simulates a provider webhook: your <strong>From</strong> must be
            the normalized email stored on this session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={busy || !inboundReady}
              onClick={() => void sendInbound("STOP")}
            >
              STOP
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={busy || !inboundReady}
              onClick={() => void sendInbound("HELP")}
            >
              HELP
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={busy || !inboundReady}
              onClick={() => void sendInbound("Thanks")}
            >
              Thanks (ack)
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inbound-from">From (email)</Label>
            <Input
              id="inbound-from"
              type="email"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inbound-body">Body</Label>
            <textarea
              id="inbound-body"
              className="min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={inboundBody}
              onChange={(e) => setInboundBody(e.target.value)}
              placeholder="STOP, HELP, or a short reply"
            />
          </div>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={busy || !from.trim() || !inboundReady}
            onClick={() => void sendInbound()}
          >
            {pending === "inbound" ? "Sending…" : "Send custom inbound"}
          </Button>
        </CardContent>
      </Card>

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-foreground"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
