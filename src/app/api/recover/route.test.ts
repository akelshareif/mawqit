import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit-api", () => ({
  rateLimitOr429: vi.fn(() => null),
}));

vi.mock("@/lib/rate-limit-memory", () => ({
  allowRateLimit: vi.fn(() => true),
}));

vi.mock("@/lib/db", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/recover-session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/recover-session")>(
    "@/lib/recover-session",
  );
  return {
    ...actual,
    findSessionForRecovery: vi.fn(),
    sendRecoveryLink: vi.fn(),
  };
});

import { getPrisma } from "@/lib/db";
import {
  findSessionForRecovery,
  GENERIC_RECOVER_RESPONSE_BODY,
  sendRecoveryLink,
} from "@/lib/recover-session";
import { POST } from "./route";

describe("POST /api/recover", () => {
  beforeEach(() => {
    vi.mocked(getPrisma).mockReturnValue({} as never);
  });

  it("returns generic message when no session matches", async () => {
    vi.mocked(findSessionForRecovery).mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: "nobody@example.com",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(GENERIC_RECOVER_RESPONSE_BODY);
    expect(sendRecoveryLink).not.toHaveBeenCalled();
  });

  it("sends link and returns generic message when session matches", async () => {
    const session = { id: "550e8400-e29b-41d4-a716-446655440000" };
    vi.mocked(findSessionForRecovery).mockResolvedValue(session as never);
    vi.mocked(sendRecoveryLink).mockResolvedValue(true);

    const res = await POST(
      new Request("http://localhost/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: "User@Example.com",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(GENERIC_RECOVER_RESPONSE_BODY);
    expect(sendRecoveryLink).toHaveBeenCalledWith(
      expect.anything(),
      session,
      "user@example.com",
    );
  });

  it("returns 503 when send fails", async () => {
    vi.mocked(findSessionForRecovery).mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
    } as never);
    vi.mocked(sendRecoveryLink).mockResolvedValue(false);

    const res = await POST(
      new Request("http://localhost/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: "user@example.com",
        }),
      }),
    );

    expect(res.status).toBe(503);
  });

  it("rejects missing contact", async () => {
    const res = await POST(
      new Request("http://localhost/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid email format", async () => {
    const res = await POST(
      new Request("http://localhost/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: "not-an-email" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("looks up the normalized email", async () => {
    vi.mocked(findSessionForRecovery).mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: "  User@Example.com " }),
      }),
    );

    expect(res.status).toBe(200);
    expect(findSessionForRecovery).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
    );
  });
});
