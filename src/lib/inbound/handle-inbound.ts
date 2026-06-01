import type { PrismaClient } from "@/generated/prisma/client";
import {
  MessageDeliveryStatus,
  MessageDirection,
  ReminderChannel,
} from "@/generated/prisma/enums";
import { formatDateInTimeZone, parseUtcDateFromYmd } from "@/lib/calendar-date";
import { getLearnToPrayUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { normalizeEmail } from "@/lib/normalize";
import { createEmailProvider } from "@/lib/providers/email";
import { sessionUrl } from "@/lib/public-url";
import { findLatestOpenCycleForAck } from "@/lib/reminder-cycle";
import { activeLocation, primaryRecipientValue } from "@/lib/session-targets";

const INBOUND_LOG = "inbound_message";
const OUTBOUND = {
  stop: "stop_reply",
  help: "help_reply",
  ack: "ack_reply",
} as const;

export type InboundChannel = "email";

export async function handleInbound(
  prisma: PrismaClient,
  channel: InboundChannel,
  fromRaw: string,
  bodyRaw: string,
): Promise<{ outcome: string }> {
  const body = bodyRaw.trim();
  const upper = body.toUpperCase();

  let from: string;
  try {
    from = normalizeEmail(fromRaw);
  } catch {
    logger.warn("inbound", "Invalid inbound address", {
      channel,
      fromPrefix: fromRaw.slice(0, 6),
    });
    return { outcome: "invalid_address" };
  }

  const session = await prisma.session.findFirst({
    where: {
      recipients: { some: { type: "email", value: from, isPrimary: true } },
    },
    include: {
      savedLocations: { where: { isActive: true }, take: 1 },
      recipients: { where: { isPrimary: true } },
    },
  });

  const reminderChannel = ReminderChannel.email;

  if (!session) {
    logger.info("inbound", "Inbound: no session for address", {
      channel,
    });
    return { outcome: "no_session" };
  }

  const sess = session;
  const loc = activeLocation(sess.savedLocations);
  const emailAddress = primaryRecipientValue(sess.recipients, "email");

  await prisma.messageLog.create({
    data: {
      sessionId: sess.id,
      channel: reminderChannel,
      type: INBOUND_LOG,
      direction: MessageDirection.inbound,
      to: from.length > 320 ? `${from.slice(0, 317)}...` : from,
      body: body.slice(0, 8000),
      status: MessageDeliveryStatus.sent,
    },
  });

  const email = createEmailProvider(prisma);

  async function sendOutbound(text: string, messageLogType: string): Promise<void> {
    if (emailAddress) {
      await email.send(emailAddress, "Mawqit", text, {
        sessionId: sess.id,
        messageLogType,
      });
    }
  }

  if (upper === "STOP") {
    await prisma.channelStatus.upsert({
      where: {
        sessionId_channel: {
          sessionId: sess.id,
          channel: reminderChannel,
        },
      },
      create: {
        sessionId: sess.id,
        channel: reminderChannel,
        disabled: true,
        disabledAt: new Date(),
      },
      update: {
        disabled: true,
        disabledAt: new Date(),
      },
    });

    await sendOutbound(
      "Notifications for email have been stopped.",
      OUTBOUND.stop,
    );
    logger.info("inbound", "Inbound: STOP received, channel disabled", {
      sessionIdPrefix: sess.id.slice(0, 8),
      channel: reminderChannel,
    });
    return { outcome: "stop" };
  }

  if (upper === "HELP") {
    const link = sessionUrl(sess.id);
    const learn = getLearnToPrayUrl();
    const text = [
      `Your session link: ${link}`,
      `Learn to pray: ${learn}`,
      "Reply STOP to stop notifications, HELP for this message, or any other reply to acknowledge the current prayer reminder.",
    ].join("\n");
    await sendOutbound(text, OUTBOUND.help);
    logger.info("inbound", "Inbound: HELP", {
      sessionIdPrefix: sess.id.slice(0, 8),
    });
    return { outcome: "help" };
  }

  if (!body) {
    logger.info("inbound", "Inbound: empty body", {
      sessionIdPrefix: sess.id.slice(0, 8),
    });
    return { outcome: "empty" };
  }

  const tz = loc?.timezone ?? null;
  if (!tz) {
    logger.info("inbound", "Inbound: ack skipped (no timezone)", {
      sessionIdPrefix: sess.id.slice(0, 8),
    });
    return { outcome: "no_timezone" };
  }

  const ymd = formatDateInTimeZone(new Date(), tz);
  const prayerDate = parseUtcDateFromYmd(ymd);

  const cycle = await findLatestOpenCycleForAck(prisma, {
    sessionId: sess.id,
    channel: reminderChannel,
    prayerDate,
    now: new Date(),
    session: {
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      timezone: loc?.timezone ?? null,
      prayerMethod: sess.prayerMethod,
    },
  });

  if (!cycle) {
    logger.info("inbound", "Inbound: no active reminder cycle for ack", {
      sessionIdPrefix: sess.id.slice(0, 8),
    });
    return { outcome: "no_active_cycle" };
  }

  await prisma.reminderCycle.update({
    where: { id: cycle.id },
    data: { ackReceived: true },
  });

  await sendOutbound(
    "Got it. Reminders for this prayer have stopped.",
    OUTBOUND.ack,
  );
  logger.info("inbound", "Inbound: ack received, persistence stopped", {
    sessionIdPrefix: sess.id.slice(0, 8),
    prayer: cycle.prayerName,
  });
  return { outcome: "ack" };
}
