import type { PrismaClient } from "@/generated/prisma/client";
import { createEmailProvider } from "@/lib/providers/email";
import { createMockSmsProvider } from "@/lib/providers/sms";
import { sessionUrl } from "@/lib/public-url";

export const RECOVER_MESSAGE_LOG_TYPE = "link_recovery";

/** Same response whether a session matched or not (no account enumeration). */
export const GENERIC_RECOVER_RESPONSE_BODY = {
  message:
    "If we have a session with that contact, we've sent your link. Check your inbox or messages.",
} as const;

export async function findSessionForRecovery(
  prisma: PrismaClient,
  channel: "email" | "sms",
  normalizedContact: string,
) {
  return prisma.session.findFirst({
    where:
      channel === "email"
        ? {
            recipients: {
              some: { type: "email", value: normalizedContact, isPrimary: true },
            },
          }
        : {
            recipients: {
              some: { type: "sms", value: normalizedContact, isPrimary: true },
            },
          },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * @returns whether delivery was logged successfully (mock or real provider).
 */
export async function sendRecoveryLink(
  prisma: PrismaClient,
  session: { id: string },
  channel: "email" | "sms",
  normalizedContact: string,
): Promise<boolean> {
  const url = sessionUrl(session.id);
  const email = createEmailProvider(prisma);
  const sms = createMockSmsProvider(prisma);

  if (channel === "email") {
    const r = await email.send(
      normalizedContact,
      "Mawqit: your session link",
      `Open your Mawqit session:\n${url}\n\nIf you didn't request this, you can ignore this email.`,
      { sessionId: session.id, messageLogType: RECOVER_MESSAGE_LOG_TYPE },
    );
    return r.success;
  }

  const r = await sms.send(
    normalizedContact,
    `Mawqit — your session link: ${url}`,
    { sessionId: session.id, messageLogType: RECOVER_MESSAGE_LOG_TYPE },
  );
  return r.success;
}
