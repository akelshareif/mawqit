/**
 * Simple in-memory sliding window rate limiter (best for single-node / dev;
 * use Redis/Upstash in multi-instance production if needed).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;

function prune(now: number): void {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) {
    if (now > b.resetAt) {
      buckets.delete(k);
    }
  }
}

/**
 * @returns true if the request is allowed, false if rate limited.
 */
export function allowRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number = WINDOW_MS,
): boolean {
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxPerWindow) {
    return false;
  }
  existing.count += 1;
  return true;
}
