import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyResendWebhook } from "./verify-resend-webhook";

const SECRET_BASE64 = "c2VjcmV0LWtleS1mb3ItdGVzdGluZw=="; // "secret-key-for-testing"
const SECRET = `whsec_${SECRET_BASE64}`;

function sign(id: string, timestamp: string, body: string): string {
  const key = Buffer.from(SECRET_BASE64, "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${sig}`;
}

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

function nowSeconds(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("verifyResendWebhook", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    delete process.env.RESEND_WEBHOOK_SECRET;
  });

  it("accepts a correctly signed payload", () => {
    const id = "msg_123";
    const ts = nowSeconds();
    const body = '{"type":"email.received"}';
    const result = verifyResendWebhook(
      body,
      headers({
        "svix-id": id,
        "svix-timestamp": ts,
        "svix-signature": sign(id, ts, body),
      }),
    );
    expect(result).toEqual({ ok: true, eventId: id });
  });

  it("accepts when one of several space-delimited signatures matches", () => {
    const id = "msg_123";
    const ts = nowSeconds();
    const body = "payload";
    const good = sign(id, ts, body);
    const result = verifyResendWebhook(
      body,
      headers({
        "svix-id": id,
        "svix-timestamp": ts,
        "svix-signature": `v1,bogussignature ${good}`,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const id = "msg_123";
    const ts = nowSeconds();
    const signature = sign(id, ts, "original");
    const result = verifyResendWebhook(
      "tampered",
      headers({
        "svix-id": id,
        "svix-timestamp": ts,
        "svix-signature": signature,
      }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects a stale timestamp outside the tolerance", () => {
    const id = "msg_123";
    const ts = String(Math.floor(Date.now() / 1000) - 600); // 10 min old
    const body = "payload";
    const result = verifyResendWebhook(
      body,
      headers({
        "svix-id": id,
        "svix-timestamp": ts,
        "svix-signature": sign(id, ts, body),
      }),
    );
    expect(result).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("rejects when headers are missing", () => {
    const result = verifyResendWebhook("payload", headers({}));
    expect(result).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("reports not_configured when the secret is unset", () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const result = verifyResendWebhook("payload", headers({}));
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });
});
