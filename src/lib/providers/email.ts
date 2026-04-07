import type { PrismaClient } from "@/generated/prisma/client";
import {
  MessageDeliveryStatus,
  MessageDirection,
  ReminderChannel,
} from "@/generated/prisma/enums";
import { Resend } from "resend";

export type EmailSendResult = { success: boolean; error?: string };

export interface EmailProvider {
  send(
    to: string,
    subject: string,
    body: string,
    metadata: {
      sessionId: string;
      prayerName?: string;
      messageLogType: string;
    },
  ): Promise<EmailSendResult>;
}

function logBodyPreview(subject: string, body: string): string {
  return `${subject}\n\n${body}`.slice(0, 8000);
}

/**
 * Logs outbound email to `message_log` (no SMTP). Use when `RESEND_*` is unset.
 */
export function createMockEmailProvider(
  prisma: PrismaClient,
): EmailProvider {
  return {
    async send(to, subject, body, metadata) {
      try {
        await prisma.messageLog.create({
          data: {
            sessionId: metadata.sessionId,
            channel: ReminderChannel.email,
            prayerName: metadata.prayerName ?? null,
            type: metadata.messageLogType,
            direction: MessageDirection.outbound,
            to,
            body: logBodyPreview(subject, body),
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

type ResendEmailOptions = {
  apiKey: string;
  /** Verified sender, e.g. `Mawqit <reminders@yourdomain.com>` */
  from: string;
};

/**
 * Sends via [Resend](https://resend.com) and mirrors each attempt in `message_log`.
 */
export function createResendEmailProvider(
  prisma: PrismaClient,
  options: ResendEmailOptions,
): EmailProvider {
  const resend = new Resend(options.apiKey);

  return {
    async send(to, subject, body, metadata) {
      const preview = logBodyPreview(subject, body);
      try {
        const result = await resend.emails.send({
          from: options.from,
          to: [to],
          subject,
          text: body,
        });

        if (result.error) {
          const err = result.error;
          const errText =
            typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : JSON.stringify(err);
          try {
            await prisma.messageLog.create({
              data: {
                sessionId: metadata.sessionId,
                channel: ReminderChannel.email,
                prayerName: metadata.prayerName ?? null,
                type: metadata.messageLogType,
                direction: MessageDirection.outbound,
                to,
                body: preview,
                status: MessageDeliveryStatus.failed,
                errorMessage: errText.slice(0, 8000),
              },
            });
          } catch {
            /* ignore secondary failure */
          }
          return { success: false, error: errText };
        }

        await prisma.messageLog.create({
          data: {
            sessionId: metadata.sessionId,
            channel: ReminderChannel.email,
            prayerName: metadata.prayerName ?? null,
            type: metadata.messageLogType,
            direction: MessageDirection.outbound,
            to,
            body: preview,
            status: MessageDeliveryStatus.sent,
          },
        });
        return { success: true };
      } catch (e) {
        const errText = e instanceof Error ? e.message : String(e);
        try {
          await prisma.messageLog.create({
            data: {
              sessionId: metadata.sessionId,
              channel: ReminderChannel.email,
              prayerName: metadata.prayerName ?? null,
              type: metadata.messageLogType,
              direction: MessageDirection.outbound,
              to,
              body: preview,
              status: MessageDeliveryStatus.failed,
              errorMessage: errText.slice(0, 8000),
            },
          });
        } catch {
          /* ignore */
        }
        return { success: false, error: errText };
      }
    },
  };
}

/**
 * Resend when `RESEND_API_KEY` and `RESEND_FROM` are set; otherwise mock.
 * Set `EMAIL_FORCE_MOCK=true` to keep mock even with Resend env (tests / local).
 */
export function createEmailProvider(prisma: PrismaClient): EmailProvider {
  if (process.env.EMAIL_FORCE_MOCK?.trim().toLowerCase() === "true") {
    return createMockEmailProvider(prisma);
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (apiKey && from) {
    return createResendEmailProvider(prisma, { apiKey, from });
  }
  return createMockEmailProvider(prisma);
}
