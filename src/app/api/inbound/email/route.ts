import { getPrisma } from "@/lib/db";
import { fetchReceivedEmail } from "@/lib/inbound/fetch-received-email";
import { handleInbound } from "@/lib/inbound/handle-inbound";
import { verifyResendWebhook } from "@/lib/inbound/verify-resend-webhook";
import {
  claimWebhookEvent,
  releaseWebhookEvent,
} from "@/lib/inbound/webhook-idempotency";
import { logger } from "@/lib/logger";
import { extractEmailAddress } from "@/lib/normalize";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import type { EmailReceivedEvent } from "resend";
import { NextResponse } from "next/server";

const RESEND_SOURCE = "resend";
const RECEIVED_EVENT = "email.received";

/**
 * Resend inbound webhook. Verifies the Svix signature, dedupes retried deliveries
 * by the `svix-id`, fetches the full message body (the webhook carries metadata
 * only), then hands STOP / HELP / ack handling to `handleInbound`.
 */
export async function POST(req: Request) {
  const limited = rateLimitOr429(req, "api-inbound-email", 120);
  if (limited) {
    return limited;
  }

  const rawBody = await req.text();
  const verification = verifyResendWebhook(rawBody, req.headers);
  if (!verification.ok) {
    if (verification.reason === "not_configured") {
      logger.error("inbound", "Inbound webhook secret not set; rejecting");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    logger.warn("inbound", "Inbound webhook signature rejected", {
      reason: verification.reason,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: unknown; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true, outcome: "invalid_json" });
  }

  if (event.type !== RECEIVED_EVENT) {
    logger.info("inbound", "Inbound webhook ignored (unhandled type)", {
      type: typeof event.type === "string" ? event.type : "unknown",
    });
    return NextResponse.json({ ok: true, outcome: "ignored_type" });
  }

  const prisma = getPrisma();
  const claimed = await claimWebhookEvent(
    prisma,
    verification.eventId,
    RESEND_SOURCE,
    RECEIVED_EVENT,
  );
  if (!claimed) {
    logger.info("inbound", "Inbound webhook duplicate, skipped");
    return NextResponse.json({ ok: true, outcome: "duplicate" });
  }

  try {
    const { email_id } = (event as EmailReceivedEvent).data;
    const received = await fetchReceivedEmail(email_id);
    const fromAddress = extractEmailAddress(received.from);
    const result = await handleInbound(prisma, "email", fromAddress, received.text);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await releaseWebhookEvent(prisma, verification.eventId).catch(() => {
      /* best-effort release; the retry will re-claim or skip */
    });
    const message = e instanceof Error ? e.message : String(e);
    logger.error("inbound", "Inbound webhook processing failed", {
      error: message,
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
