import { getPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ok: true,
      database: "skipped",
      detail: "DATABASE_URL not configured",
    });
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "ok" });
  } catch (err) {
    logger.error("api", "Health check database query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, database: "error" },
      { status: 503 },
    );
  }
}
