import type { PrismaClient } from "@/generated/prisma/client";
import { createEmailProvider } from "@/lib/providers/email";
import { sessionUrl } from "@/lib/public-url";

export const RECOVER_MESSAGE_LOG_TYPE = "link_recovery";

/** Same response whether a session matched or not (no account enumeration). */
export const GENERIC_RECOVER_RESPONSE_BODY = {
  message:
    "If we have a session with that email, we've sent your link. Check your inbox.",
} as const;

export async function findSessionForRecovery(
  prisma: PrismaClient,
  normalizedEmail: string,
) {
  return prisma.session.findFirst({
    where: {
      recipients: {
        some: { type: "email", value: normalizedEmail, isPrimary: true },
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
  normalizedEmail: string,
): Promise<boolean> {
  const url = sessionUrl(session.id);
  const email = createEmailProvider(prisma);

  const r = await email.send(
    normalizedEmail,
    "Mawqit: your session link",
    `Open your Mawqit session:\n${url}\n\nIf you didn't request this, you can ignore this email.`,
    { sessionId: session.id, messageLogType: RECOVER_MESSAGE_LOG_TYPE },
  );
  return r.success;
}
