import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit-api", () => ({
  rateLimitOr429: vi.fn(() => null),
}));
vi.mock("@/lib/db", () => ({
  getPrisma: vi.fn(() => ({})),
}));
vi.mock("@/lib/inbound/verify-resend-webhook", () => ({
  verifyResendWebhook: vi.fn(),
}));
vi.mock("@/lib/inbound/fetch-received-email", () => ({
  fetchReceivedEmail: vi.fn(),
}));
vi.mock("@/lib/inbound/handle-inbound", () => ({
  handleInbound: vi.fn(),
}));
vi.mock("@/lib/inbound/webhook-idempotency", () => ({
  claimWebhookEvent: vi.fn(),
  releaseWebhookEvent: vi.fn(),
}));

import { fetchReceivedEmail } from "@/lib/inbound/fetch-received-email";
import { handleInbound } from "@/lib/inbound/handle-inbound";
import { verifyResendWebhook } from "@/lib/inbound/verify-resend-webhook";
import {
  claimWebhookEvent,
  releaseWebhookEvent,
} from "@/lib/inbound/webhook-idempotency";
import { rateLimitOr429 } from "@/lib/rate-limit-api";
import { NextResponse } from "next/server";
import { POST } from "./route";

const verifyMock = vi.mocked(verifyResendWebhook);
const fetchMock = vi.mocked(fetchReceivedEmail);
const handleMock = vi.mocked(handleInbound);
const claimMock = vi.mocked(claimWebhookEvent);
const releaseMock = vi.mocked(releaseWebhookEvent);
const rateLimitMock = vi.mocked(rateLimitOr429);

function req(body: unknown): Request {
  return new Request("http://localhost/api/inbound/email", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function receivedEvent() {
  return {
    type: "email.received",
    data: { email_id: "em_1", from: "User <user@example.com>" },
  };
}

describe("POST /api/inbound/email", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockReturnValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );
    const res = await POST(req("{}"));
    expect(res.status).toBe(429);
  });

  it("returns 500 when the webhook secret is not configured", async () => {
    verifyMock.mockReturnValue({ ok: false, reason: "not_configured" });
    const res = await POST(req("{}"));
    expect(res.status).toBe(500);
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("returns 401 on an invalid signature", async () => {
    verifyMock.mockReturnValue({ ok: false, reason: "invalid_signature" });
    const res = await POST(req("{}"));
    expect(res.status).toBe(401);
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("ignores non email.received events without claiming", async () => {
    verifyMock.mockReturnValue({ ok: true, eventId: "msg_1" });
    const res = await POST(req({ type: "email.delivered", data: {} }));
    const json = await res.json();
    expect(json.outcome).toBe("ignored_type");
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("skips a duplicate delivery", async () => {
    verifyMock.mockReturnValue({ ok: true, eventId: "msg_1" });
    claimMock.mockResolvedValue(false);
    const res = await POST(req(receivedEvent()));
    const json = await res.json();
    expect(json.outcome).toBe("duplicate");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handleMock).not.toHaveBeenCalled();
  });

  it("fetches the body and passes the bare address to handleInbound", async () => {
    verifyMock.mockReturnValue({ ok: true, eventId: "msg_1" });
    claimMock.mockResolvedValue(true);
    fetchMock.mockResolvedValue({ from: "User <user@example.com>", text: "STOP" });
    handleMock.mockResolvedValue({ outcome: "stop" });

    const res = await POST(req(receivedEvent()));
    const json = await res.json();

    expect(fetchMock).toHaveBeenCalledWith("em_1");
    expect(handleMock).toHaveBeenCalledWith(
      expect.anything(),
      "email",
      "user@example.com",
      "STOP",
    );
    expect(json.outcome).toBe("stop");
  });

  it("releases the claim and returns 500 when processing throws", async () => {
    verifyMock.mockReturnValue({ ok: true, eventId: "msg_1" });
    claimMock.mockResolvedValue(true);
    releaseMock.mockResolvedValue();
    fetchMock.mockRejectedValue(new Error("resend down"));

    const res = await POST(req(receivedEvent()));

    expect(res.status).toBe(500);
    expect(releaseMock).toHaveBeenCalledWith(expect.anything(), "msg_1");
    expect(handleMock).not.toHaveBeenCalled();
  });
});
