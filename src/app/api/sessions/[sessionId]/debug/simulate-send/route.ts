import { formatDateInTimeZone } from "@/lib/calendar-date";
import { DEBUG_PUSH_NOTIFICATION_TAG } from "@/lib/debug-notification-tag";
import { getPrisma } from "@/lib/db";
import { getEnableDebugTools } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createEmailProvider } from "@/lib/providers/email";
import { createWebPushProvider } from "@/lib/providers/web-push";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { sessionUrl } from "@/lib/public-url";
import { isSessionIdFormat } from "@/lib/session-id";
import { activeLocation, primaryRecipientValue } from "@/lib/session-targets";
import { NextResponse } from "next/server";

const DEBUG_TYPE = "debug_simulate_send";

type Body = {
  channel?: string;
  /** When set, subject/body mention this many seconds until “due” (for realistic QA copy). */
  dueInSeconds?: number;
};

function clampDueSeconds(n: number): number {
  return Math.min(86_400, Math.max(1, Math.round(n)));
}

type RouteCtx = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  if (!getEnableDebugTools()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = rateLimitOr429(req, "api-debug-simulate-send", 30);
  if (limited) {
    return limited;
  }

  const { sessionId } = await ctx.params;
  if (!isSessionIdFormat(sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channel = parsed.channel === "browser" ? "browser" : "email";
  const rawDue = parsed.dueInSeconds;
  const dueInSeconds =
    typeof rawDue === "number" && Number.isFinite(rawDue)
      ? clampDueSeconds(rawDue)
      : undefined;
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      savedLocations: { where: { isActive: true }, take: 1 },
      recipients: { where: { isPrimary: true } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loc = activeLocation(session.savedLocations);
  const emailAddress = primaryRecipientValue(session.recipients, "email");

  if (channel === "email") {
    if (!session.emailEnabled || !emailAddress) {
      return NextResponse.json(
        { error: "Email is not enabled or no address saved." },
        { status: 400 },
      );
    }
    const emailSubject =
      dueInSeconds != null
        ? `Mawqit (debug): Fajr due in ~${dueInSeconds}s`
        : "Mawqit (debug): simulated send";
    const emailBody =
      dueInSeconds != null
        ? `Test email as if the prayer were due in ~${dueInSeconds} second(s). (Debug — same mock path as cron.)`
        : "This is a test message from the debug page. It is recorded in your message log.";

    const email = createEmailProvider(prisma);
    const result = await email.send(
      emailAddress,
      emailSubject,
      emailBody,
      {
        sessionId,
        prayerName: "fajr",
        messageLogType: DEBUG_TYPE,
      },
    );
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Send failed" },
        { status: 500 },
      );
    }
    logger.info("api", "Debug simulate-send email", {
      sessionIdPrefix: sessionId.slice(0, 8),
    });
    return NextResponse.json({ ok: true, channel: "email" });
  }

  if (!session.browserNotificationsEnabled) {
    return NextResponse.json(
      { error: "Browser notifications are not enabled." },
      { status: 400 },
    );
  }

  const sub = await prisma.pushSubscription.findFirst({
    where: { sessionId },
  });
  if (!sub) {
    return NextResponse.json(
      { error: "No browser notification subscription for this session." },
      { status: 400 },
    );
  }

  const tz = loc?.timezone ?? null;
  if (!tz) {
    return NextResponse.json(
      { error: "Session has no timezone." },
      { status: 400 },
    );
  }

  const ymd = formatDateInTimeZone(new Date(), tz);

  const pushTitle =
    dueInSeconds != null
      ? `Mawqit (debug): due in ~${dueInSeconds}s`
      : "Mawqit (debug): simulated send";
  const pushBody =
    dueInSeconds != null
      ? `Test browser notification as if due in ~${dueInSeconds}s.`
      : "Test browser notification from the debug page.";

  /** Always real Web Push here so the debug page delivers an actual notification (cron may still use `WEB_PUSH_MODE=mock`). */
  const push = createWebPushProvider(prisma, { mode: "real" });
  const openUrl = sessionUrl(sessionId);
  const result = await push.sendPrayerReminder(
    {
      id: sub.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    sessionId,
    "fajr",
    pushTitle,
    pushBody,
    openUrl,
    {
      prayerDateYmd: ymd,
      deviceKey: sub.id,
      messageLogType: DEBUG_TYPE,
      tag: DEBUG_PUSH_NOTIFICATION_TAG,
    },
  );

  if (result.gone) {
    await prisma.pushSubscription.delete({ where: { id: sub.id } });
    return NextResponse.json(
      { error: "Subscription expired; subscribe again from the dashboard." },
      { status: 410 },
    );
  }

  if (!result.success) {
    logger.warn("api", "Debug simulate-send push failed", {
      sessionIdPrefix: sessionId.slice(0, 8),
      error: result.error,
    });
    return NextResponse.json(
      { error: result.error ?? "Push failed" },
      { status: 500 },
    );
  }

  logger.info("api", "Debug simulate-send browser", {
    sessionIdPrefix: sessionId.slice(0, 8),
  });
  return NextResponse.json({
    ok: true,
    channel: "browser",
    notification: { title: pushTitle, body: pushBody },
  });
}
