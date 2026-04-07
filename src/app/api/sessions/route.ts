import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, "api-sessions-create", 20);
  if (limited) {
    return limited;
  }

  try {
    const session = await getPrisma().session.create({ data: {} });
    logger.info("api", "POST /api/sessions created", {
      sessionIdPrefix: session.id.slice(0, 8),
    });
    return NextResponse.json({ id: session.id }, { status: 201 });
  } catch (e) {
    logger.error("api", "POST /api/sessions failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Could not create a session. Try again." },
      { status: 500 },
    );
  }
}
