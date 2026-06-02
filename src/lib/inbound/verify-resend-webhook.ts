import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend signs inbound webhooks with Svix. We verify the signature manually
 * (HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, base64) rather than reaching
 * for the SDK so this stays network-free and unit-testable. The raw request body
 * must be passed unchanged — the signature is byte-sensitive.
 *
 * Spec: https://docs.svix.com/receiving/verifying-payloads/how-manual
 */

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export type WebhookVerifyResult =
  | { ok: true; eventId: string }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "missing_headers"
        | "stale_timestamp"
        | "invalid_signature";
    };

export function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
): WebhookVerifyResult {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "not_configured" };
  }

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) {
    return { ok: false, reason: "missing_headers" };
  }

  if (!isFreshTimestamp(timestamp)) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest();

  // The header is a space-delimited list of `v1,<base64>` signatures; any match passes.
  for (const part of signatureHeader.split(" ")) {
    const comma = part.indexOf(",");
    if (comma === -1) continue;
    if (part.slice(0, comma) !== "v1") continue;
    const provided = Buffer.from(part.slice(comma + 1), "base64");
    if (
      provided.length === expected.length &&
      timingSafeEqual(provided, expected)
    ) {
      return { ok: true, eventId: id };
    }
  }

  return { ok: false, reason: "invalid_signature" };
}

function isFreshTimestamp(timestamp: string): boolean {
  const seconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(Date.now() - seconds * 1000) <= TIMESTAMP_TOLERANCE_MS;
}
