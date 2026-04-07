import { allowRateLimit } from "@/lib/rate-limit-memory";
import { getRequestIp } from "@/lib/request-ip";
import { NextResponse } from "next/server";

/**
 * @returns `NextResponse` with 429 if limited, otherwise `null` (caller continues).
 */
export function rateLimitOr429(
  req: Request,
  namespace: string,
  maxPerMinute: number,
): NextResponse | null {
  const ip = getRequestIp(req);
  if (!allowRateLimit(`${namespace}:${ip}`, maxPerMinute, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}
