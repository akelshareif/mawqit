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
import { POST } from "./route";

describe("POST /api/sessions", () => {
  it("creates session and returns id", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(getPrisma).mockReturnValue({
      session: {
        create: vi.fn().mockResolvedValue({ id }),
      },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/sessions", { method: "POST" }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(id);
  });
});
