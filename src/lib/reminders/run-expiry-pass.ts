import type { PrismaClient } from "@/generated/prisma/client";
import {
  ReminderChannel,
  SessionStatus,
} from "@/generated/prisma/enums";
import { formatDateInTimeZone } from "@/lib/calendar-date";
import { getSessionExpiryWarningDays } from "@/lib/env";
import { logger } from "@/lib/logger";
import { MESSAGE_TYPE } from "@/lib/message-types";
import {
  createEmailProvider,
  type EmailProvider,
} from "@/lib/providers/email";
import { createWebPushProvider } from "@/lib/providers/web-push";
import { sessionUrl } from "@/lib/public-url";

function wantsEmail(session: {
  emailEnabled: boolean;
  emailAddress: string | null;
}): session is typeof session & { emailAddress: string } {
  return Boolean(session.emailEnabled && session.emailAddress);
}

export async function runExpiryPass(
  prisma: PrismaClient,
  realNow: Date,
): Promise<{ sessionsProcessed: number; messagesSent: number }> {
  const warningDays = getSessionExpiryWarningDays();
  const warningMs = warningDays * 24 * 60 * 60 * 1000;

  const expiredCount = await prisma.session.updateMany({
    where: {
      sessionStatus: SessionStatus.active,
      expiresAt: { not: null, lte: realNow },
    },
    data: { sessionStatus: SessionStatus.expired },
  });

  if (expiredCount.count > 0) {
    logger.info("cron", "Marked sessions expired", { count: expiredCount.count });
  }

  const sessions = await prisma.session.findMany({
    where: {
      sessionStatus: SessionStatus.active,
      expiresAt: { not: null, gt: realNow },
      timezone: { not: null },
    },
  });

  const email = createEmailProvider(prisma);
  const webPush = createWebPushProvider(prisma);

  let messagesSent = 0;

  for (const session of sessions) {
    const tz = session.timezone!;
    const exp = session.expiresAt!;
    const link = sessionUrl(session.id);

    const ymdNow = formatDateInTimeZone(realNow, tz);
    const ymdExp = formatDateInTimeZone(exp, tz);
    const isExpiryCalendarDay = ymdNow === ymdExp;

    const msUntilExpiry = exp.getTime() - realNow.getTime();
    const inWarningWindow =
      msUntilExpiry > 0 && msUntilExpiry <= warningMs && !isExpiryCalendarDay;

    const [emailCh, browserCh] = await Promise.all([
      prisma.channelStatus.findUnique({
        where: {
          sessionId_channel: {
            sessionId: session.id,
            channel: ReminderChannel.email,
          },
        },
      }),
      prisma.channelStatus.findUnique({
        where: {
          sessionId_channel: {
            sessionId: session.id,
            channel: ReminderChannel.browser,
          },
        },
      }),
    ]);
    const emailChannelDisabled = emailCh?.disabled === true;
    const browserChannelDisabled = browserCh?.disabled === true;

    if (isExpiryCalendarDay && !session.expiryDayReminderSentAt) {
      const sent = await sendExpiryDay(
        prisma,
        email,
        webPush,
        session,
        session.id,
        link,
        tz,
        emailChannelDisabled,
        browserChannelDisabled,
      );
      messagesSent += sent;
      continue;
    }

    if (inWarningWindow && !session.expiryWarningSentAt) {
      const sent = await sendExpiryWarning(
        prisma,
        email,
        webPush,
        session,
        session.id,
        link,
        tz,
        emailChannelDisabled,
        browserChannelDisabled,
      );
      messagesSent += sent;
    }
  }

  return { sessionsProcessed: sessions.length, messagesSent };
}

async function sendExpiryWarning(
  prisma: PrismaClient,
  email: EmailProvider,
  webPush: ReturnType<typeof createWebPushProvider>,
  session: {
    id: string;
    emailEnabled: boolean;
    emailAddress: string | null;
    browserNotificationsEnabled: boolean;
  },
  sessionId: string,
  link: string,
  tz: string,
  emailChannelDisabled: boolean,
  browserChannelDisabled: boolean,
): Promise<number> {
  const subject = "Mawqit: your session expires soon";
  const body = `Your Mawqit session will expire soon. Open your settings and save to extend it:\n${link}\n\n(Time zone: ${tz})`;

  let count = 0;
  let anyChannelOk = false;

  if (wantsEmail(session) && !emailChannelDisabled) {
    const r = await email.send(session.emailAddress!, subject, body, {
      sessionId,
      messageLogType: MESSAGE_TYPE.sessionExpiryWarning,
    });
    if (r.success) {
      count += 1;
      anyChannelOk = true;
    }
  }

  if (session.browserNotificationsEnabled && !browserChannelDisabled) {
    const subs = await prisma.pushSubscription.findMany({
      where: { sessionId },
    });
    for (const sub of subs) {
      const r = await webPush.sendSessionMessage(
        {
          id: sub.id,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        sessionId,
        MESSAGE_TYPE.sessionExpiryWarning,
        "Mawqit: session expires soon",
        `Open and save settings to extend. ${link}`,
        link,
      );
      if (r.gone) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        continue;
      }
      if (r.success) {
        count += 1;
        anyChannelOk = true;
      }
    }
  }

  if (anyChannelOk) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiryWarningSentAt: new Date() },
    });
    logger.info("cron", "Session expiry warning sent", {
      sessionIdPrefix: sessionId.slice(0, 8),
    });
  }

  return count;
}

async function sendExpiryDay(
  prisma: PrismaClient,
  email: EmailProvider,
  webPush: ReturnType<typeof createWebPushProvider>,
  session: {
    id: string;
    emailEnabled: boolean;
    emailAddress: string | null;
    browserNotificationsEnabled: boolean;
  },
  sessionId: string,
  link: string,
  tz: string,
  emailChannelDisabled: boolean,
  browserChannelDisabled: boolean,
): Promise<number> {
  const subject = "Mawqit: your session expires today";
  const body = `Your Mawqit session expires today. Open your settings and save to renew:\n${link}\n\n(Time zone: ${tz})`;

  let count = 0;
  let anyChannelOk = false;

  if (wantsEmail(session) && !emailChannelDisabled) {
    const r = await email.send(session.emailAddress!, subject, body, {
      sessionId,
      messageLogType: MESSAGE_TYPE.sessionExpiryDay,
    });
    if (r.success) {
      count += 1;
      anyChannelOk = true;
    }
  }

  if (session.browserNotificationsEnabled && !browserChannelDisabled) {
    const subs = await prisma.pushSubscription.findMany({
      where: { sessionId },
    });
    for (const sub of subs) {
      const r = await webPush.sendSessionMessage(
        {
          id: sub.id,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        sessionId,
        MESSAGE_TYPE.sessionExpiryDay,
        "Mawqit: session expires today",
        `Save settings to renew. ${link}`,
        link,
      );
      if (r.gone) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        continue;
      }
      if (r.success) {
        count += 1;
        anyChannelOk = true;
      }
    }
  }

  if (anyChannelOk) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expiryDayReminderSentAt: new Date() },
    });
    logger.info("cron", "Session expiry day reminder sent", {
      sessionIdPrefix: sessionId.slice(0, 8),
    });
  }

  return count;
}
