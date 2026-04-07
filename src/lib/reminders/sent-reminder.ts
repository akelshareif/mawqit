import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ReminderChannel } from "@/generated/prisma/enums";

export async function tryCreateSentReminder(
  prisma: PrismaClient,
  args: {
    sessionId: string;
    prayerName: string;
    prayerDate: Date;
    channel: ReminderChannel;
    messageType: string;
    pushSubscriptionId: string | null;
  },
): Promise<{ id: string } | null> {
  try {
    return await prisma.sentReminder.create({
      data: {
        sessionId: args.sessionId,
        prayerName: args.prayerName,
        prayerDate: args.prayerDate,
        channel: args.channel,
        messageType: args.messageType,
        pushSubscriptionId: args.pushSubscriptionId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return null;
    }
    throw e;
  }
}
