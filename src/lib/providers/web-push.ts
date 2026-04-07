import type { PrismaClient } from "@/generated/prisma/client";
import {
  MessageDeliveryStatus,
  MessageDirection,
  ReminderChannel,
} from "@/generated/prisma/enums";
import { getVapidSubject, getWebPushMode } from "@/lib/env";
import { MESSAGE_TYPE } from "@/lib/message-types";
import webpush, { WebPushError, type PushSubscription } from "web-push";

export type WebPushSendResult = {
  success: boolean;
  error?: string;
  /** True when subscription should be removed (410/404). */
  gone?: boolean;
  statusCode?: number;
};

export type PrayerReminderPushOptions = {
  prayerDateYmd?: string;
  deviceKey?: string;
  messageLogType?: string;
  /** Passed to `showNotification({ tag })` in the service worker. */
  tag?: string;
};

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY are required for real Web Push");
  }
  webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
  vapidConfigured = true;
}

function subscriptionForWebPush(row: PushRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

/**
 * Sends a Web Push notification; mock mode writes `message_log` only (no FCM/APNs).
 */
async function deliverWebPush(
  prisma: PrismaClient,
  mode: "mock" | "real",
  row: PushRow,
  sessionId: string,
  prayerName: string | null,
  messageLogType: string,
  title: string,
  body: string,
  openUrl: string,
  dataExtra: Record<string, unknown>,
): Promise<WebPushSendResult> {
  const deviceKey =
    typeof dataExtra.deviceKey === "string" ? dataExtra.deviceKey : row.id;
  const payload = JSON.stringify({
    title,
    body,
    data: {
      url: openUrl,
      sessionId,
      prayerName,
      ackUrl: `/api/sessions/${sessionId}/reminders/ack`,
      deviceKey,
      ...dataExtra,
    },
  });

  if (mode === "mock") {
    try {
      await prisma.messageLog.create({
        data: {
          sessionId,
          channel: ReminderChannel.browser,
          prayerName,
          type: messageLogType,
          direction: MessageDirection.outbound,
          to: row.endpoint.length > 320 ? `${row.endpoint.slice(0, 317)}...` : row.endpoint,
          body: payload.slice(0, 8000),
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
  }

  try {
    ensureVapidConfigured();
    await webpush.sendNotification(subscriptionForWebPush(row), payload, {
      TTL: 86_400,
      urgency: "high",
    });

    await prisma.messageLog.create({
      data: {
        sessionId,
        channel: ReminderChannel.browser,
        prayerName,
        type: messageLogType,
        direction: MessageDirection.outbound,
        to: row.endpoint.length > 320 ? `${row.endpoint.slice(0, 317)}...` : row.endpoint,
        body: payload.slice(0, 8000),
        status: MessageDeliveryStatus.sent,
      },
    });

    return { success: true };
  } catch (e: unknown) {
    if (e instanceof WebPushError) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        return {
          success: false,
          gone: true,
          error: e.message,
        };
      }
      return {
        success: false,
        error: e.message,
        statusCode: e.statusCode,
      };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export type WebPushProviderOptions = {
  /**
   * Overrides `WEB_PUSH_MODE`. Debug simulate-send uses `{ mode: "real" }` so
   * you get a real notification even when cron uses mock.
   */
  mode?: "mock" | "real";
};

export function createWebPushProvider(
  prisma: PrismaClient,
  options?: WebPushProviderOptions,
): {
  sendPrayerReminder: (
    row: PushRow,
    sessionId: string,
    prayerName: string,
    title: string,
    body: string,
    openUrl: string,
    options?: PrayerReminderPushOptions,
  ) => Promise<WebPushSendResult>;
  sendSessionMessage: (
    row: PushRow,
    sessionId: string,
    messageLogType: string,
    title: string,
    body: string,
    openUrl: string,
  ) => Promise<WebPushSendResult>;
} {
  const mode: "mock" | "real" = options?.mode ?? getWebPushMode();

  return {
    async sendPrayerReminder(row, sessionId, prayerName, title, body, openUrl, options) {
      const messageLogType = options?.messageLogType ?? MESSAGE_TYPE.prayerReminder;
      const prayerDateYmd = options?.prayerDateYmd;
      const deviceKey = options?.deviceKey ?? row.id;
      return deliverWebPush(
        prisma,
        mode,
        row,
        sessionId,
        prayerName,
        messageLogType,
        title,
        body,
        openUrl,
        {
          prayerDateYmd,
          deviceKey,
          kind: "prayer",
          ...(options?.tag ? { tag: options.tag } : {}),
        },
      );
    },
    async sendSessionMessage(row, sessionId, messageLogType, title, body, openUrl) {
      return deliverWebPush(
        prisma,
        mode,
        row,
        sessionId,
        null,
        messageLogType,
        title,
        body,
        openUrl,
        { kind: "session" },
      );
    },
  };
}
