import { NextResponse } from "next/server";

/** Public VAPID key for `PushManager.subscribe` (safe in client bundle). */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured." },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}
