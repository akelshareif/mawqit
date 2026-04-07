import { DebugSessionTools } from "@/components/debug-session-tools";
import { getPrisma } from "@/lib/db";
import {
  getEnableDebugTools,
  getQaReminderClockOffsetMinutes,
  getReminderNow,
  isQaReminderClockEnabled,
} from "@/lib/env";
import { isSessionIdFormat } from "@/lib/session-id";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ sessionId: string }> };

export default async function SessionDebugPage({ params }: PageProps) {
  if (!getEnableDebugTools()) {
    notFound();
  }

  const { sessionId } = await params;
  if (!isSessionIdFormat(sessionId)) {
    notFound();
  }

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    notFound();
  }

  const logs = await prisma.messageLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const pushSubCount = await prisma.pushSubscription.count({
    where: { sessionId },
  });
  const emailReady = Boolean(
    session.emailEnabled && session.emailAddress?.trim(),
  );
  let browserPushBlockedReason: string | null = null;
  if (!session.browserNotificationsEnabled) {
    browserPushBlockedReason =
      "Enable browser notifications in Location & Reminders.";
  } else if (!session.timezone?.trim()) {
    browserPushBlockedReason = "Save a location and timezone first.";
  } else if (pushSubCount === 0) {
    browserPushBlockedReason =
      "No push subscription for this session — enable notifications on Home for this device.";
  }
  const browserPushReady = browserPushBlockedReason === null;
  const inboundReady = Boolean(session.emailAddress?.trim());

  const realNow = new Date();
  const reminderNow = getReminderNow(realNow);
  const offsetMin = getQaReminderClockOffsetMinutes();
  const qaClockOn = isQaReminderClockEnabled();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div className="space-y-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Debug
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Exercise notifications and inbound handling for this session. Use the
          controls below, then confirm rows in the message log. Hidden in
          production unless debug tooling is explicitly allowed via env.
        </p>
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground">
          <span className="font-medium">Cron / QA clock:</span>{" "}
          {!qaClockOn ? (
            <>
              Off. Enable{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                ENABLE_QA_REMINDER_CLOCK
              </code>{" "}
              or{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                ENABLE_DEBUG_TOOLS
              </code>
              , then{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                QA_REMINDER_CLOCK_OFFSET_MINUTES
              </code>{" "}
              to shift “now” for scheduled reminders. Session expiry still uses
              real time.
            </>
          ) : offsetMin === 0 ? (
            <>On at offset 0 (wall clock for due checks).</>
          ) : (
            <>
              Offset{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {offsetMin > 0 ? "+" : ""}
                {offsetMin}
              </code>{" "}
              min → virtual time{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {reminderNow.toISOString().slice(0, 19)}Z
              </code>
              .
            </>
          )}
        </p>
      </div>

      <DebugSessionTools
        sessionId={sessionId}
        defaultEmail={session.emailAddress ?? ""}
        emailReady={emailReady}
        browserPushReady={browserPushReady}
        browserPushBlockedReason={browserPushBlockedReason}
        inboundReady={inboundReady}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Message log</h2>
        <p className="text-sm text-muted-foreground">
          Outbound and inbound mock sends append here (newest first).
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2 font-medium">Time</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Channel
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  Direction
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">To / preview</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No messages yet.
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums text-muted-foreground">
                      {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      {row.channel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      {row.direction}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 align-top font-mono text-xs">
                      {row.type}
                    </td>
                    <td className="max-w-md px-3 py-2 align-top">
                      <div className="truncate text-muted-foreground">
                        {row.to}
                      </div>
                      {row.body ? (
                        <div className="mt-1 line-clamp-2 break-words text-foreground">
                          {row.body}
                        </div>
                      ) : null}
                      {row.status === "failed" && row.errorMessage ? (
                        <div className="mt-1 text-xs text-destructive">
                          {row.errorMessage}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
