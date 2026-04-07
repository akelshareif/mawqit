import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeEmail, normalizePhoneE164 } from "@/lib/normalize";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { allowRateLimit } from "@/lib/rate-limit-memory";
import {
  findSessionForRecovery,
  GENERIC_RECOVER_RESPONSE_BODY,
  sendRecoveryLink,
} from "@/lib/recover-session";
import { NextResponse } from "next/server";

const IP_MAX_PER_MINUTE = 20;
const CONTACT_MAX_PER_MINUTE = 8;

function contactRateKey(channel: string, normalized: string): string {
  return `api-recover-contact:${channel}:${normalized}`;
}

function logContactPrefix(channel: "email" | "sms", normalized: string): string {
  if (channel === "email") {
    const [local, domain] = normalized.split("@");
    if (!domain) return "email:?";
    return `email:${local?.slice(0, 2) ?? ""}…@${domain}`;
  }
  return `sms:${normalized.slice(0, 4)}…`;
}

export async function POST(req: Request) {
  const limitedIp = rateLimitOr429(req, "api-recover", IP_MAX_PER_MINUTE);
  if (limitedIp) {
    return limitedIp;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const channelRaw = (body as { channel?: unknown }).channel;
  const contactRaw = (body as { contact?: unknown }).contact;

  if (channelRaw !== "email" && channelRaw !== "sms") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const channel = channelRaw;
  const contact =
    typeof contactRaw === "string" ? contactRaw.trim() : "";

  if (!contact || contact.length > 320) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let normalized: string;
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }
    normalized = normalizeEmail(contact);
  } else {
    try {
      normalized = normalizePhoneE164(contact);
    } catch {
      return NextResponse.json(
        {
          error:
            "Use a full international number with country code, e.g. +1234567890.",
        },
        { status: 400 },
      );
    }
  }

  if (!allowRateLimit(contactRateKey(channel, normalized), CONTACT_MAX_PER_MINUTE)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const prisma = getPrisma();
  const session = await findSessionForRecovery(prisma, channel, normalized);

  logger.info("api", "POST /api/recover attempt", {
    channel,
    contactPrefix: logContactPrefix(channel, normalized),
    matched: Boolean(session),
  });

  if (!session) {
    return NextResponse.json(GENERIC_RECOVER_RESPONSE_BODY);
  }

  const ok = await sendRecoveryLink(prisma, session, channel, normalized);
  if (!ok) {
    logger.error("api", "POST /api/recover send failed", {
      sessionIdPrefix: session.id.slice(0, 8),
      channel,
    });
    return NextResponse.json(
      { error: "Could not send. Try again later." },
      { status: 503 },
    );
  }

  logger.info("api", "POST /api/recover link sent", {
    sessionIdPrefix: session.id.slice(0, 8),
    channel,
  });

  return NextResponse.json(GENERIC_RECOVER_RESPONSE_BODY);
}
