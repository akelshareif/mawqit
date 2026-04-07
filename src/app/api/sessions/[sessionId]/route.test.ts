import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit-api", () => ({
  rateLimitOr429: vi.fn(() => null),
}));

vi.mock("@/lib/db", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { getPrisma } from "@/lib/db";
import { DELETE, GET } from "./route";

const validId = "550e8400-e29b-41d4-a716-446655440000";

describe("GET /api/sessions/[sessionId]", () => {
  it("returns 404 for invalid id format", async () => {
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ sessionId: "not-uuid" }),
    });
    expect(res.status).toBe(404);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it("returns session json when found", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      session: {
        findUnique: vi.fn().mockResolvedValue({ id: validId, timezone: "UTC" }),
      },
    } as never);

    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ sessionId: validId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(validId);
  });
});

describe("DELETE /api/sessions/[sessionId]", () => {
  it("returns 404 for invalid id format", async () => {
    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ sessionId: "not-uuid" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes session when found", async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPrisma).mockReturnValue({
      session: {
        findUnique: vi.fn().mockResolvedValue({ id: validId }),
        delete: del,
      },
    } as never);

    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ sessionId: validId }),
    });
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledWith({ where: { id: validId } });
  });

  it("returns 404 when session missing", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      session: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as never);

    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ sessionId: validId }),
    });
    expect(res.status).toBe(404);
  });
});
