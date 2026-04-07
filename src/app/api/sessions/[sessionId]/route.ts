import { SessionStatus } from "@/generated/prisma/enums";
import { getSessionValidityDays } from "@/lib/env";
import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { parseSetupPayload } from "@/lib/setup-payload";
import { isSessionIdFormat } from "@/lib/session-id";
import { syncChannelStatuses } from "@/lib/session-channel-status";
import { NextResponse } from "next/server";

type RouteCtx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { sessionId } = await ctx.params;
  if (!isSessionIdFormat(sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getPrisma().session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { sessionId } = await ctx.params;
  if (!isSessionIdFormat(sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = rateLimitOr429(req, "api-sessions-patch", 60);
  if (limited) {
    return limited;
  }

  const existing = await getPrisma().session.findUnique({
    where: { id: sessionId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseSetupPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const d = parsed.data;
  const days = getSessionValidityDays();
  const expiresAt = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000,
  );

  try {
    const prisma = getPrisma();
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        latitude: d.latitude,
        longitude: d.longitude,
        timezone: d.timezone,
        emailEnabled: d.emailEnabled,
        emailAddress: d.emailAddress,
        smsEnabled: d.smsEnabled,
        phoneNumber: d.phoneNumber,
        browserNotificationsEnabled: d.browserNotificationsEnabled,
        persistentReminders: d.persistentReminders,
        persistenceCadenceMinutes: d.persistenceCadenceMinutes,
        followupEnabled: d.followupEnabled,
        followupDelayMinutes: d.followupDelayMinutes,
        prayerMethod: d.prayerMethod,
        expiresAt,
        sessionStatus: SessionStatus.active,
        expiryWarningSentAt: null,
        expiryDayReminderSentAt: null,
      },
    });

    await syncChannelStatuses(prisma, sessionId, {
      emailEnabled: d.emailEnabled,
      smsEnabled: d.smsEnabled,
      browserNotificationsEnabled: d.browserNotificationsEnabled,
    });

    logger.info("api", "PATCH /api/sessions saved setup", {
      sessionIdPrefix: sessionId.slice(0, 8),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("api", "PATCH /api/sessions failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Could not save settings. Try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const { sessionId } = await ctx.params;
  if (!isSessionIdFormat(sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = rateLimitOr429(req, "api-sessions-delete", 10);
  if (limited) {
    return limited;
  }

  const prisma = getPrisma();
  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.session.delete({ where: { id: sessionId } });
    logger.info("api", "DELETE /api/sessions session deleted", {
      sessionIdPrefix: sessionId.slice(0, 8),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("api", "DELETE /api/sessions failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Could not delete session. Try again." },
      { status: 500 },
    );
  }
}
