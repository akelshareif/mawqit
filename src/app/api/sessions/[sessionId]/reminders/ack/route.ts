import { ReminderChannel } from "@/generated/prisma/enums";
import { parseUtcDateFromYmd } from "@/lib/calendar-date";
import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { isSessionIdFormat } from "@/lib/session-id";
import { NextResponse } from "next/server";

type Body = {
  prayerName?: string;
  prayerDate?: string;
  channel?: string;
  deviceKey?: string;
};

function parsePrayerDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseUtcDateFromYmd(trimmed);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return parseUtcDateFromYmd(
    `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
  );
}

type RouteCtx = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const { sessionId } = await ctx.params;
  if (!isSessionIdFormat(sessionId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = rateLimitOr429(req, `api-reminders-ack:${sessionId}`, 120);
  if (limited) {
    return limited;
  }

  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prayerName = typeof parsed.prayerName === "string" ? parsed.prayerName.trim() : "";
  const prayerDateRaw = typeof parsed.prayerDate === "string" ? parsed.prayerDate : "";
  const channelRaw = typeof parsed.channel === "string" ? parsed.channel : "";
  const deviceKey =
    typeof parsed.deviceKey === "string" ? parsed.deviceKey.trim() : "";

  if (!prayerName || !prayerDateRaw) {
    return NextResponse.json(
      { error: "prayerName and prayerDate are required" },
      { status: 400 },
    );
  }

  if (channelRaw.toLowerCase() !== "browser") {
    return NextResponse.json({ error: "Only channel browser is supported" }, { status: 400 });
  }

  const prayerDate = parsePrayerDate(prayerDateRaw);
  if (!prayerDate) {
    return NextResponse.json({ error: "Invalid prayerDate" }, { status: 400 });
  }

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await prisma.reminderCycle.updateMany({
    where: {
      sessionId,
      channel: ReminderChannel.browser,
      prayerName,
      prayerDate,
      deviceKey,
      ackReceived: false,
    },
    data: { ackReceived: true },
  });

  if (result.count === 0) {
    logger.info("api", "Ack: no matching reminder cycle", {
      sessionIdPrefix: sessionId.slice(0, 8),
    });
    return NextResponse.json({ ok: true, updated: 0 });
  }

  logger.info("inbound", "Browser ack recorded", {
    sessionIdPrefix: sessionId.slice(0, 8),
    prayer: prayerName,
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
