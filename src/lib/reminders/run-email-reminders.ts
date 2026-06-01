import { Coordinates, PrayerTimes } from "adhan";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  MessageDeliveryStatus,
  MessageDirection,
  ReminderChannel,
  SessionStatus,
} from "@/generated/prisma/enums";
import { formatDateInTimeZone, parseUtcDateFromYmd } from "@/lib/calendar-date";
import { logger } from "@/lib/logger";
import { MESSAGE_TYPE } from "@/lib/message-types";
import { createEmailProvider } from "@/lib/providers/email";
import { getCalculationParameters, resolvePrayerDate } from "@/lib/prayer-times";
import { upsertReminderCycleOnSend } from "@/lib/reminder-cycle";
import {
  labelForKey,
  prayerTimeForKey,
  SALAH_KEYS,
} from "@/lib/reminders/prayer-reminder-common";
import { tryCreateSentReminder } from "@/lib/reminders/sent-reminder";
import type { CronReminderClocks } from "@/lib/reminders/cron-clocks";
import { activeLocation, primaryRecipientValue } from "@/lib/session-targets";

export async function runEmailReminderPass(
  prisma: PrismaClient,
  clocks: CronReminderClocks,
): Promise<{ sessionsProcessed: number; messagesSent: number }> {
  const { realNow, reminderNow } = clocks;
  const email = createEmailProvider(prisma);

  const sessions = await prisma.session.findMany({
    where: {
      emailEnabled: true,
      recipients: { some: { type: "email", isPrimary: true } },
      savedLocations: { some: { isActive: true } },
      sessionStatus: SessionStatus.active,
      expiresAt: { gt: realNow },
      NOT: {
        channelStatuses: {
          some: {
            channel: ReminderChannel.email,
            disabled: true,
          },
        },
      },
    },
    include: {
      savedLocations: { where: { isActive: true }, take: 1 },
      recipients: { where: { isPrimary: true } },
    },
  });

  let messagesSent = 0;

  for (const session of sessions) {
    const loc = activeLocation(session.savedLocations);
    const emailTo = primaryRecipientValue(session.recipients, "email");
    if (!loc || !emailTo) {
      continue;
    }
    const lat = loc.latitude;
    const lng = loc.longitude;
    const tz = loc.timezone;

    const coords = new Coordinates(lat, lng);
    const params = getCalculationParameters({
      prayerMethod: session.prayerMethod,
      asrMethod: session.asrMethod,
      highLatitudeRule: session.highLatitudeRule,
    });
    const day = resolvePrayerDate(tz, reminderNow);
    const pt = new PrayerTimes(coords, day, params);
    const ymd = formatDateInTimeZone(reminderNow, tz);
    const prayerDate = parseUtcDateFromYmd(ymd);

    for (const key of SALAH_KEYS) {
      const prayerInstant = prayerTimeForKey(pt, key);
      if (reminderNow.getTime() < prayerInstant.getTime()) {
        continue;
      }

      const claimed = await tryCreateSentReminder(prisma, {
        sessionId: session.id,
        prayerName: key,
        prayerDate,
        channel: ReminderChannel.email,
        messageType: MESSAGE_TYPE.prayerReminder,
        pushSubscriptionId: null,
      });
      if (!claimed) {
        continue;
      }

      const label = labelForKey(key);
      const subject = `Mawqit: ${label} prayer time`;
      const body = `It's time for ${label}. This reminder uses your saved location and calculation method in Mawqit.`;

      const result = await email.send(emailTo, subject, body, {
        sessionId: session.id,
        prayerName: key,
        messageLogType: MESSAGE_TYPE.prayerReminder,
      });

      if (!result.success) {
        await prisma.sentReminder.delete({ where: { id: claimed.id } });
        await prisma.messageLog.create({
          data: {
            sessionId: session.id,
            channel: ReminderChannel.email,
            prayerName: key,
            type: MESSAGE_TYPE.prayerReminder,
            direction: MessageDirection.outbound,
            to: emailTo,
            body: result.error ?? "send failed",
            status: MessageDeliveryStatus.failed,
            errorMessage: result.error ?? "unknown",
          },
        });
        logger.warn("cron", "Email reminder send failed", {
          sessionIdPrefix: session.id.slice(0, 8),
          prayer: key,
        });
        continue;
      }

      messagesSent += 1;
      await upsertReminderCycleOnSend(prisma, {
        sessionId: session.id,
        channel: ReminderChannel.email,
        prayerName: key,
        prayerDate,
        deviceKey: "",
      });
      logger.info("cron", "Email reminder sent", {
        sessionIdPrefix: session.id.slice(0, 8),
        prayer: key,
      });
    }
  }

  return { sessionsProcessed: sessions.length, messagesSent };
}
