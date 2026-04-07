import { getPrisma } from "@/lib/db";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { isSessionIdFormat } from "@/lib/session-id";
import { NextResponse } from "next/server";

type Body = {
  sessionId?: string;
  endpoint?: string;
};

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, "api-push-unsubscribe", 40);
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
  const endpoint = body.endpoint?.trim();
  if (!sessionId || !isSessionIdFormat(sessionId) || !endpoint) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const prisma = getPrisma();
  await prisma.pushSubscription.deleteMany({
    where: { sessionId, endpoint },
  });

  return NextResponse.json({ ok: true });
}
