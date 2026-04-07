import { handleInbound } from "@/lib/inbound/handle-inbound";
import { getPrisma } from "@/lib/db";
import { getEnableDebugTools } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { NextResponse } from "next/server";

type Body = {
  channel?: string;
  from?: string;
  body?: string;
};

export async function POST(req: Request) {
  if (!getEnableDebugTools()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = rateLimitOr429(req, "api-debug-simulate-inbound", 30);
  if (limited) {
    return limited;
  }

  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true, outcome: "invalid_json" });
  }

  const channelRaw = typeof parsed.channel === "string" ? parsed.channel : "";
  const from = typeof parsed.from === "string" ? parsed.from : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";

  const ch = channelRaw.toLowerCase();
  if (ch !== "email" && ch !== "sms") {
    return NextResponse.json({ ok: true, outcome: "bad_channel" });
  }

  try {
    const prisma = getPrisma();
    const result = await handleInbound(prisma, ch, from, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("api", "simulate-inbound failed", { error: message });
    return NextResponse.json({ ok: true, outcome: "error" });
  }
}
