import type { PrismaClient } from "@/generated/prisma/client";
import { ReminderChannel } from "@/generated/prisma/enums";

type ChannelFlags = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  browserNotificationsEnabled: boolean;
};

/**
 * Keep `channel_status` aligned with session toggles (including STOP/disabled).
 */
export async function syncChannelStatuses(
  prisma: PrismaClient,
  sessionId: string,
  flags: ChannelFlags,
): Promise<void> {
  const entries: { channel: (typeof ReminderChannel)[keyof typeof ReminderChannel]; enabled: boolean }[] =
    [
      { channel: ReminderChannel.email, enabled: flags.emailEnabled },
      { channel: ReminderChannel.sms, enabled: flags.smsEnabled },
      { channel: ReminderChannel.browser, enabled: flags.browserNotificationsEnabled },
    ];

  for (const { channel, enabled } of entries) {
    if (enabled) {
      await prisma.channelStatus.upsert({
        where: {
          sessionId_channel: { sessionId, channel },
        },
        create: { sessionId, channel, disabled: false },
        update: { disabled: false, disabledAt: null },
      });
    } else {
      await prisma.channelStatus.deleteMany({
        where: { sessionId, channel },
      });
    }
  }
}
