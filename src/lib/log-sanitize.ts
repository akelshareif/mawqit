/**
 * Redact sensitive keys and long opaque values before structured logs (Slice 9).
 */

function sanitizeKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (
    lower === "authorization" ||
    lower === "cookie" ||
    lower === "password" ||
    lower === "auth" ||
    lower === "p256dh" ||
    lower === "privatekey"
  ) {
    return true;
  }
  if (
    lower.includes("secret") ||
    lower.includes("token") ||
    lower.includes("credential") ||
    lower.includes("apikey") ||
    lower.includes("bearer")
  ) {
    return true;
  }
  return false;
}

function looksLikeOpaqueSecret(s: string): boolean {
  if (s.length < 24) return false;
  if (/postgresql:\/\//i.test(s) || /mysql:\/\//i.test(s)) return true;
  if (/^[\d\sa-f:-]+$/i.test(s) && s.length < 96) return false;
  if (s.length < 32) return false;
  const b64ish = /^[A-Za-z0-9+/=_-]+$/;
  return b64ish.test(s);
}

export function sanitizeLogValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    if (looksLikeOpaqueSecret(value)) {
      return "[redacted]";
    }
    if (
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
    ) {
      return `${value.slice(0, 8)}…`;
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeLogValue(v));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (sanitizeKey(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = sanitizeLogValue(v);
      }
    }
    return out;
  }
  return value;
}

export function sanitizeLogMeta(
  meta?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!meta || Object.keys(meta).length === 0) {
    return meta;
  }
  return sanitizeLogValue(meta) as Record<string, unknown>;
}
