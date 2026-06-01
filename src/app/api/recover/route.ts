import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeEmail } from "@/lib/normalize";
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

function contactRateKey(normalized: string): string {
  return `api-recover-contact:email:${normalized}`;
}

function logContactPrefix(normalized: string): string {
  const [local, domain] = normalized.split("@");
  if (!domain) return "email:?";
  return `email:${local?.slice(0, 2) ?? ""}…@${domain}`;
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

  const contactRaw = (body as { contact?: unknown }).contact;
  const contact =
    typeof contactRaw === "string" ? contactRaw.trim() : "";

  if (!contact || contact.length > 320) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const normalized = normalizeEmail(contact);

  if (!allowRateLimit(contactRateKey(normalized), CONTACT_MAX_PER_MINUTE)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const prisma = getPrisma();
  const session = await findSessionForRecovery(prisma, normalized);

  logger.info("api", "POST /api/recover attempt", {
    contactPrefix: logContactPrefix(normalized),
    matched: Boolean(session),
  });

  if (!session) {
    return NextResponse.json(GENERIC_RECOVER_RESPONSE_BODY);
  }

  const ok = await sendRecoveryLink(prisma, session, normalized);
  if (!ok) {
    logger.error("api", "POST /api/recover send failed", {
      sessionIdPrefix: session.id.slice(0, 8),
    });
    return NextResponse.json(
      { error: "Could not send. Try again later." },
      { status: 503 },
    );
  }

  logger.info("api", "POST /api/recover link sent", {
    sessionIdPrefix: session.id.slice(0, 8),
  });

  return NextResponse.json(GENERIC_RECOVER_RESPONSE_BODY);
}
