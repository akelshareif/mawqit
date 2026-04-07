import type { PrismaClient } from "@/generated/prisma/client";
import {
  MessageDeliveryStatus,
  MessageDirection,
  ReminderChannel,
} from "@/generated/prisma/enums";

export type SmsSendResult = { success: boolean; error?: string };

export interface SmsProvider {
  send(
    to: string,
    body: string,
    metadata: {
      sessionId: string;
      prayerName?: string;
      messageLogType: string;
    },
  ): Promise<SmsSendResult>;
}

/**
 * Logs outbound SMS to `message_log` (no Twilio). Twilio-ready structure.
 */
export function createMockSmsProvider(prisma: PrismaClient): SmsProvider {
  return {
    async send(to, body, metadata) {
      try {
        await prisma.messageLog.create({
          data: {
            sessionId: metadata.sessionId,
            channel: ReminderChannel.sms,
            prayerName: metadata.prayerName ?? null,
            type: metadata.messageLogType,
            direction: MessageDirection.outbound,
            to,
            body: body.slice(0, 8000),
            status: MessageDeliveryStatus.sent,
          },
        });
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
  };
}
