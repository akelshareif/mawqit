import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { isSessionIdFormat } from "@/lib/session-id";
import { NextResponse } from "next/server";

type Body = {
  sessionId?: string;
  subscription?: {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, "api-push-subscribe", 40);
  if (limited) {
    return limited;
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const sessionId = body.sessionId;
  if (!sessionId || !isSessionIdFormat(sessionId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  const sub = body.subscription;
  const endpoint = sub?.endpoint?.trim();
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid PushSubscription payload." }, { status: 400 });
  }

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!session.browserNotificationsEnabled) {
    return NextResponse.json(
      { error: "Browser notifications are not enabled for this session." },
      { status: 400 },
    );
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      sessionId,
      endpoint,
      p256dh,
      auth,
    },
    update: {
      sessionId,
      p256dh,
      auth,
    },
  });

  logger.info("api", "Web Push subscription saved", {
    sessionIdPrefix: sessionId.slice(0, 8),
  });

  return NextResponse.json({ ok: true });
}
