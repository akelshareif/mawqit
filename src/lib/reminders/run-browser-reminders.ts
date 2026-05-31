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
import { createWebPushProvider } from "@/lib/providers/web-push";
import { getCalculationParameters, resolvePrayerDate } from "@/lib/prayer-times";
import { sessionUrl } from "@/lib/public-url";
import { upsertReminderCycleOnSend } from "@/lib/reminder-cycle";
import {
  labelForKey,
  prayerTimeForKey,
  SALAH_KEYS,
} from "@/lib/reminders/prayer-reminder-common";
import { tryCreateSentReminder } from "@/lib/reminders/sent-reminder";
import type { CronReminderClocks } from "@/lib/reminders/cron-clocks";
import { activeLocation } from "@/lib/session-targets";

export async function runBrowserReminderPass(
  prisma: PrismaClient,
  clocks: CronReminderClocks,
): Promise<{ sessionsProcessed: number; messagesSent: number }> {
  const { realNow, reminderNow } = clocks;
  const push = createWebPushProvider(prisma);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      session: {
        browserNotificationsEnabled: true,
        savedLocations: { some: { isActive: true } },
        sessionStatus: SessionStatus.active,
        expiresAt: { gt: realNow },
        NOT: {
          channelStatuses: {
            some: {
              channel: ReminderChannel.browser,
              disabled: true,
            },
          },
        },
      },
    },
    include: {
      session: {
        include: { savedLocations: { where: { isActive: true }, take: 1 } },
      },
    },
  });

  const distinctSessions = new Set(subscriptions.map((s) => s.sessionId));
  let messagesSent = 0;

  for (const sub of subscriptions) {
    const session = sub.session;
    const loc = activeLocation(session.savedLocations);
    if (!loc) {
      continue;
    }
    const lat = loc.latitude;
    const lng = loc.longitude;
    const tz = loc.timezone;

    const coords = new Coordinates(lat, lng);
    const params = getCalculationParameters(session.prayerMethod);
    const day = resolvePrayerDate(tz, reminderNow);
    const pt = new PrayerTimes(coords, day, params);
    const ymd = formatDateInTimeZone(reminderNow, tz);
    const prayerDate = parseUtcDateFromYmd(ymd);
    const openUrl = sessionUrl(session.id);

    for (const key of SALAH_KEYS) {
      const prayerInstant = prayerTimeForKey(pt, key);
      if (reminderNow.getTime() < prayerInstant.getTime()) {
        continue;
      }

      const claimed = await tryCreateSentReminder(prisma, {
        sessionId: session.id,
        prayerName: key,
        prayerDate,
        channel: ReminderChannel.browser,
        messageType: MESSAGE_TYPE.prayerReminder,
        pushSubscriptionId: sub.id,
      });
      if (!claimed) {
        continue;
      }

      const label = labelForKey(key);
      const title = `Mawqit: ${label}`;
      const body = `It's time for ${label}. Open your session to view times.`;

      const result = await push.sendPrayerReminder(
        {
          id: sub.id,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        session.id,
        key,
        title,
        body,
        openUrl,
        { prayerDateYmd: ymd, deviceKey: sub.id },
      );

      if (result.gone) {
        await prisma.sentReminder.delete({ where: { id: claimed.id } });
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        logger.info("cron", "Removed expired Web Push subscription", {
          sessionIdPrefix: session.id.slice(0, 8),
        });
        break;
      }

      if (!result.success) {
        await prisma.sentReminder.delete({ where: { id: claimed.id } });
        await prisma.messageLog.create({
          data: {
            sessionId: session.id,
            channel: ReminderChannel.browser,
            prayerName: key,
            type: MESSAGE_TYPE.prayerReminder,
            direction: MessageDirection.outbound,
            to: sub.endpoint.length > 320 ? `${sub.endpoint.slice(0, 317)}...` : sub.endpoint,
            body: result.error ?? "send failed",
            status: MessageDeliveryStatus.failed,
            errorMessage: result.error ?? "unknown",
          },
        });
        logger.warn("cron", "Web Push reminder failed", {
          sessionIdPrefix: session.id.slice(0, 8),
          prayer: key,
        });
        continue;
      }

      messagesSent += 1;
      await upsertReminderCycleOnSend(prisma, {
        sessionId: session.id,
        channel: ReminderChannel.browser,
        prayerName: key,
        prayerDate,
        deviceKey: sub.id,
      });
      logger.info("cron", "Web Push reminder sent", {
        sessionIdPrefix: session.id.slice(0, 8),
        prayer: key,
      });
    }
  }

  return { sessionsProcessed: distinctSessions.size, messagesSent };
}
