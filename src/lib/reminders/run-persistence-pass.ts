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
import {
  createEmailProvider,
  type EmailProvider,
} from "@/lib/providers/email";
import { createMockSmsProvider } from "@/lib/providers/sms";
import { createWebPushProvider } from "@/lib/providers/web-push";
import { sessionUrl } from "@/lib/public-url";
import {
  isReminderCycleStale,
  markCycleFollowupSent,
  MAX_RESENDS_PER_CYCLE,
  touchCycleAfterPersistenceSend,
} from "@/lib/reminder-cycle";
import { labelForKey } from "@/lib/reminders/prayer-reminder-common";
import { tryCreateSentReminder } from "@/lib/reminders/sent-reminder";
import type { CronReminderClocks } from "@/lib/reminders/cron-clocks";
import { activeLocation, primaryRecipientValue } from "@/lib/session-targets";
import type { RecipientType } from "@/generated/prisma/enums";

type PersistenceSession = {
  id: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  savedLocations: { latitude: number; longitude: number; timezone: string }[];
  recipients: { type: RecipientType; value: string; isPrimary: boolean }[];
};

export async function runPersistencePass(
  prisma: PrismaClient,
  clocks: CronReminderClocks,
): Promise<{ sessionsProcessed: number; messagesSent: number }> {
  const { realNow, reminderNow } = clocks;
  const cycles = await prisma.reminderCycle.findMany({
    where: {
      ackReceived: false,
      session: {
        sessionStatus: SessionStatus.active,
        expiresAt: { gt: realNow },
      },
    },
    include: {
      session: {
        include: {
          savedLocations: { where: { isActive: true }, take: 1 },
          recipients: { where: { isPrimary: true } },
        },
      },
    },
  });

  const email = createEmailProvider(prisma);
  const sms = createMockSmsProvider(prisma);
  const push = createWebPushProvider(prisma);

  const sessionsProcessed = new Set(cycles.map((c) => c.sessionId));
  let messagesSent = 0;

  for (const cycle of cycles) {
    const session = cycle.session;
    const loc = activeLocation(session.savedLocations);
    if (!loc) {
      continue;
    }

    if (
      isReminderCycleStale(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          timezone: loc.timezone,
          prayerMethod: session.prayerMethod,
        },
        cycle,
        reminderNow,
      )
    ) {
      continue;
    }

    const ch = await prisma.channelStatus.findUnique({
      where: {
        sessionId_channel: {
          sessionId: session.id,
          channel: cycle.channel,
        },
      },
    });
    if (ch?.disabled) {
      continue;
    }

    const tz = loc.timezone;
    const ymd = formatDateInTimeZone(reminderNow, tz);
    const prayerDate = parseUtcDateFromYmd(ymd);
    if (cycle.prayerDate.getTime() !== prayerDate.getTime()) {
      continue;
    }

    const label = labelForKey(cycle.prayerName);
    const openUrl = sessionUrl(session.id);

    const cadenceMs = Math.max(1, session.persistenceCadenceMinutes) * 60 * 1000;
    if (!cycle.lastSentAt) {
      continue;
    }
    const last = cycle.lastSentAt.getTime();
    const followupDelayMs =
      Math.max(0, session.followupDelayMinutes) * 60 * 1000;
    const first = cycle.firstSentAt?.getTime() ?? 0;

    const followupDue =
      session.followupEnabled &&
      !cycle.followupSent &&
      first > 0 &&
      reminderNow.getTime() - first >= followupDelayMs;

    const resendDue =
      session.persistentReminders &&
      cycle.resendCount < MAX_RESENDS_PER_CYCLE &&
      reminderNow.getTime() - last >= cadenceMs;

    if (followupDue) {
      const sent = await sendFollowupForChannel({
        prisma,
        cycle,
        session,
        channel: cycle.channel,
        prayerDate,
        label,
        openUrl,
        email,
        sms,
        push,
        now: reminderNow,
      });
      if (sent) {
        messagesSent += 1;
      }
      continue;
    }

    if (resendDue) {
      const sent = await sendResendForChannel({
        prisma,
        cycle,
        session,
        channel: cycle.channel,
        prayerDate,
        label,
        openUrl,
        email,
        sms,
        push,
        now: reminderNow,
      });
      if (sent) {
        messagesSent += 1;
      }
    }
  }

  return { sessionsProcessed: sessionsProcessed.size, messagesSent };
}

async function sendFollowupForChannel(args: {
  prisma: PrismaClient;
  cycle: {
    id: string;
    sessionId: string;
    prayerName: string;
    deviceKey: string;
  };
  session: PersistenceSession;
  channel: ReminderChannel;
  prayerDate: Date;
  label: string;
  openUrl: string;
  email: EmailProvider;
  sms: ReturnType<typeof createMockSmsProvider>;
  push: ReturnType<typeof createWebPushProvider>;
  now: Date;
}): Promise<boolean> {
  const {
    prisma,
    cycle,
    session,
    channel,
    prayerDate,
    label,
    openUrl,
    email,
    sms,
    push,
    now,
  } = args;

  const emailAddress = primaryRecipientValue(session.recipients, "email");
  const phoneNumber = primaryRecipientValue(session.recipients, "sms");
  const timezone = activeLocation(session.savedLocations)?.timezone ?? null;

  const pushSubscriptionId =
    channel === ReminderChannel.browser ? cycle.deviceKey || null : null;

  const claimed = await tryCreateSentReminder(prisma, {
    sessionId: session.id,
    prayerName: cycle.prayerName,
    prayerDate,
    channel,
    messageType: MESSAGE_TYPE.followup,
    pushSubscriptionId,
  });
  if (!claimed) {
    await markCycleFollowupSent(prisma, cycle.id, now);
    return false;
  }

  const subject = `Mawqit: follow-up — ${label}`;
  const body = `We have not heard from you about ${label} yet. Open your session if you still need the times: ${openUrl}`;

  if (channel === ReminderChannel.email) {
    if (!session.emailEnabled || !emailAddress) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const result = await email.send(emailAddress, subject, body, {
      sessionId: session.id,
      prayerName: cycle.prayerName,
      messageLogType: MESSAGE_TYPE.followup,
    });
    if (!result.success) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    await markCycleFollowupSent(prisma, cycle.id, now);
    logger.info("cron", "Persistence follow-up email sent", {
      sessionIdPrefix: session.id.slice(0, 8),
      prayer: cycle.prayerName,
    });
    return true;
  }

  if (channel === ReminderChannel.sms) {
    if (!session.smsEnabled || !phoneNumber) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const result = await sms.send(phoneNumber, body, {
      sessionId: session.id,
      prayerName: cycle.prayerName,
      messageLogType: MESSAGE_TYPE.followup,
    });
    if (!result.success) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    await markCycleFollowupSent(prisma, cycle.id, now);
    logger.info("cron", "Persistence follow-up SMS sent", {
      sessionIdPrefix: session.id.slice(0, 8),
    });
    return true;
  }

  if (channel === ReminderChannel.browser) {
    if (!session.browserNotificationsEnabled || !cycle.deviceKey || !timezone) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const sub = await prisma.pushSubscription.findFirst({
      where: { id: cycle.deviceKey, sessionId: session.id },
    });
    if (!sub) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const ymd = formatDateInTimeZone(now, timezone);
    const result = await push.sendPrayerReminder(
      {
        id: sub.id,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
      session.id,
      cycle.prayerName,
      `Mawqit: follow-up — ${label}`,
      body,
      openUrl,
      {
        prayerDateYmd: ymd,
        deviceKey: sub.id,
        messageLogType: MESSAGE_TYPE.followup,
      },
    );
    if (result.gone) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      await prisma.pushSubscription.delete({ where: { id: sub.id } });
      return false;
    }
    if (!result.success) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      await prisma.messageLog.create({
        data: {
          sessionId: session.id,
          channel: ReminderChannel.browser,
          prayerName: cycle.prayerName,
          type: MESSAGE_TYPE.followup,
          direction: MessageDirection.outbound,
          to:
            sub.endpoint.length > 320
              ? `${sub.endpoint.slice(0, 317)}...`
              : sub.endpoint,
          body: result.error ?? "send failed",
          status: MessageDeliveryStatus.failed,
          errorMessage: result.error ?? "unknown",
        },
      });
      return false;
    }
    await markCycleFollowupSent(prisma, cycle.id, now);
    logger.info("cron", "Persistence follow-up Web Push sent", {
      sessionIdPrefix: session.id.slice(0, 8),
    });
    return true;
  }

  await prisma.sentReminder.delete({ where: { id: claimed.id } });
  return false;
}

async function sendResendForChannel(args: {
  prisma: PrismaClient;
  cycle: {
    id: string;
    sessionId: string;
    prayerName: string;
    deviceKey: string;
  };
  session: PersistenceSession;
  channel: ReminderChannel;
  prayerDate: Date;
  label: string;
  openUrl: string;
  email: EmailProvider;
  sms: ReturnType<typeof createMockSmsProvider>;
  push: ReturnType<typeof createWebPushProvider>;
  now: Date;
}): Promise<boolean> {
  const {
    prisma,
    cycle,
    session,
    channel,
    prayerDate,
    label,
    openUrl,
    email,
    sms,
    push,
    now,
  } = args;

  const emailAddress = primaryRecipientValue(session.recipients, "email");
  const phoneNumber = primaryRecipientValue(session.recipients, "sms");
  const timezone = activeLocation(session.savedLocations)?.timezone ?? null;

  const pushSubscriptionId =
    channel === ReminderChannel.browser ? cycle.deviceKey || null : null;

  const claimed = await tryCreateSentReminder(prisma, {
    sessionId: session.id,
    prayerName: cycle.prayerName,
    prayerDate,
    channel,
    messageType: MESSAGE_TYPE.persistenceResend,
    pushSubscriptionId,
  });
  if (!claimed) {
    return false;
  }

  const subject = `Mawqit reminder: ${label}`;
  const body = `Still time for ${label}. Open your session: ${openUrl}`;

  if (channel === ReminderChannel.email) {
    if (!session.emailEnabled || !emailAddress) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const result = await email.send(emailAddress, subject, body, {
      sessionId: session.id,
      prayerName: cycle.prayerName,
      messageLogType: MESSAGE_TYPE.persistenceResend,
    });
    if (!result.success) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    await touchCycleAfterPersistenceSend(prisma, cycle.id, now);
    logger.info("cron", "Persistence resend email sent", {
      sessionIdPrefix: session.id.slice(0, 8),
      prayer: cycle.prayerName,
    });
    return true;
  }

  if (channel === ReminderChannel.sms) {
    if (!session.smsEnabled || !phoneNumber) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const result = await sms.send(phoneNumber, body, {
      sessionId: session.id,
      prayerName: cycle.prayerName,
      messageLogType: MESSAGE_TYPE.persistenceResend,
    });
    if (!result.success) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    await touchCycleAfterPersistenceSend(prisma, cycle.id, now);
    return true;
  }

  if (channel === ReminderChannel.browser) {
    if (!session.browserNotificationsEnabled || !cycle.deviceKey || !timezone) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const sub = await prisma.pushSubscription.findFirst({
      where: { id: cycle.deviceKey, sessionId: session.id },
    });
    if (!sub) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      return false;
    }
    const ymd = formatDateInTimeZone(now, timezone);
    const result = await push.sendPrayerReminder(
      {
        id: sub.id,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
      session.id,
      cycle.prayerName,
      subject.replace("Mawqit reminder: ", "Mawqit: "),
      body,
      openUrl,
      {
        prayerDateYmd: ymd,
        deviceKey: sub.id,
        messageLogType: MESSAGE_TYPE.persistenceResend,
      },
    );
    if (result.gone) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      await prisma.pushSubscription.delete({ where: { id: sub.id } });
      return false;
    }
    if (!result.success) {
      await prisma.sentReminder.delete({ where: { id: claimed.id } });
      await prisma.messageLog.create({
        data: {
          sessionId: session.id,
          channel: ReminderChannel.browser,
          prayerName: cycle.prayerName,
          type: MESSAGE_TYPE.persistenceResend,
          direction: MessageDirection.outbound,
          to:
            sub.endpoint.length > 320
              ? `${sub.endpoint.slice(0, 317)}...`
              : sub.endpoint,
          body: result.error ?? "send failed",
          status: MessageDeliveryStatus.failed,
          errorMessage: result.error ?? "unknown",
        },
      });
      return false;
    }
    await touchCycleAfterPersistenceSend(prisma, cycle.id, now);
    return true;
  }

  await prisma.sentReminder.delete({ where: { id: claimed.id } });
  return false;
}
