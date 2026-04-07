import { Coordinates, PrayerTimes } from "adhan";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ReminderCycle } from "@/generated/prisma/client";
import type { ReminderChannel } from "@/generated/prisma/enums";
import { formatDateInTimeZone, parseUtcDateFromYmd } from "@/lib/calendar-date";
import { getCalculationParameters } from "@/lib/prayer-times";
import {
  nextPrayerKeyAfter,
  prayerTimeForKey,
} from "@/lib/reminders/prayer-reminder-common";

const MAX_RESENDS_PER_CYCLE = 6;

export { MAX_RESENDS_PER_CYCLE };

export async function upsertReminderCycleOnSend(
  prisma: PrismaClient,
  args: {
    sessionId: string;
    channel: ReminderChannel;
    prayerName: string;
    prayerDate: Date;
    deviceKey: string;
  },
): Promise<void> {
  const now = new Date();
  await prisma.reminderCycle.upsert({
    where: {
      sessionId_channel_prayerName_prayerDate_deviceKey: {
        sessionId: args.sessionId,
        channel: args.channel,
        prayerName: args.prayerName,
        prayerDate: args.prayerDate,
        deviceKey: args.deviceKey,
      },
    },
    create: {
      sessionId: args.sessionId,
      channel: args.channel,
      prayerName: args.prayerName,
      prayerDate: args.prayerDate,
      deviceKey: args.deviceKey,
      firstSentAt: now,
      lastSentAt: now,
    },
    update: {
      lastSentAt: now,
    },
  });
}

type SessionStaleFields = {
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  prayerMethod: string;
};

/** True when the next prayer time after this cycle’s slot has passed (cycle is done for persistence). */
export function isReminderCycleStale(
  session: SessionStaleFields,
  cycle: { prayerName: string; prayerDate: Date },
  now: Date,
): boolean {
  if (
    session.latitude == null ||
    session.longitude == null ||
    !session.timezone
  ) {
    return true;
  }
  const tz = session.timezone;
  const ymdToday = formatDateInTimeZone(now, tz);
  const ymdCycle = formatDateInTimeZone(cycle.prayerDate, tz);
  if (ymdCycle !== ymdToday) {
    return true;
  }
  const day = parseUtcDateFromYmd(ymdToday);
  const coords = new Coordinates(session.latitude, session.longitude);
  const params = getCalculationParameters(session.prayerMethod);
  const pt = new PrayerTimes(coords, day, params);
  const nextKey = nextPrayerKeyAfter(cycle.prayerName);
  if (nextKey) {
    const nextInstant = prayerTimeForKey(pt, nextKey);
    return now.getTime() >= nextInstant.getTime();
  }
  const nextDay = new Date(day.getTime());
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const ptNext = new PrayerTimes(coords, nextDay, params);
  return now.getTime() >= ptNext.fajr.getTime();
}

export async function findLatestOpenCycleForAck(
  prisma: PrismaClient,
  args: {
    sessionId: string;
    channel: ReminderChannel;
    prayerDate: Date;
    now: Date;
    session: SessionStaleFields;
  },
): Promise<ReminderCycle | null> {
  const rows = await prisma.reminderCycle.findMany({
    where: {
      sessionId: args.sessionId,
      channel: args.channel,
      prayerDate: args.prayerDate,
      ackReceived: false,
    },
    orderBy: [{ lastSentAt: "desc" }],
  });
  for (const c of rows) {
    if (!isReminderCycleStale(args.session, c, args.now)) {
      return c;
    }
  }
  return null;
}

export async function touchCycleAfterPersistenceSend(
  prisma: PrismaClient,
  cycleId: string,
  now: Date,
): Promise<void> {
  await prisma.reminderCycle.update({
    where: { id: cycleId },
    data: {
      resendCount: { increment: 1 },
      lastSentAt: now,
    },
  });
}

export async function markCycleFollowupSent(
  prisma: PrismaClient,
  cycleId: string,
  now: Date,
): Promise<void> {
  await prisma.reminderCycle.update({
    where: { id: cycleId },
    data: {
      followupSent: true,
      lastSentAt: now,
    },
  });
}
