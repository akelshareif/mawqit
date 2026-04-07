import { timingSafeEqual } from "node:crypto";

/**
 * Verify `Authorization: Bearer <CRON_SECRET>` (constant-time).
 */
export function verifyCronSecret(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length === 0) {
    return false;
  }
  const expected = `Bearer ${secret}`;
  if (!authorization || authorization.length !== expected.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
  } catch {
    return false;
  }
}
