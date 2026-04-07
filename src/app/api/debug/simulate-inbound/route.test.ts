import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getEnableDebugTools: vi.fn(() => false),
}));

vi.mock("@/lib/rate-limit-api", () => ({
  rateLimitOr429: vi.fn(() => null),
}));

import { POST } from "./route";

describe("POST /api/debug/simulate-inbound", () => {
  it("404 when debug tools disabled", async () => {
    const req = new Request("http://localhost/api/debug/simulate-inbound", {
      method: "POST",
      body: JSON.stringify({ channel: "email", from: "a@b.com", body: "x" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
