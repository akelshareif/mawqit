import type { PrismaClient } from "@/generated/prisma/client";

/** Prisma's unique-constraint-violation code. */
const UNIQUE_VIOLATION = "P2002";

/**
 * Claim a webhook delivery so a retried delivery (same Svix message id) is
 * processed at most once. Returns `true` the first time an id is seen — the caller
 * should process the event — and `false` if it was already claimed, in which case
 * the caller acks and skips. If processing then fails, call `releaseWebhookEvent`
 * so the retry can re-claim and try again.
 */
export async function claimWebhookEvent(
  prisma: PrismaClient,
  id: string,
  source: string,
  type: string,
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({ data: { id, source, type } });
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) {
      return false;
    }
    throw e;
  }
}

export async function releaseWebhookEvent(
  prisma: PrismaClient,
  id: string,
): Promise<void> {
  await prisma.webhookEvent.deleteMany({ where: { id } });
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
