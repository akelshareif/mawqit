import { describe, expect, it, vi } from "vitest";
import { rateLimitOr429 } from "./rate-limit-api";

vi.mock("@/lib/rate-limit-memory", () => ({
  allowRateLimit: vi.fn(),
}));

import { allowRateLimit } from "@/lib/rate-limit-memory";

describe("rateLimitOr429", () => {
  it("returns null when allowed", async () => {
    vi.mocked(allowRateLimit).mockReturnValue(true);
    const req = new Request("https://x", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    expect(rateLimitOr429(req, "api", 10)).toBeNull();
  });

  it("returns 429 when limited", async () => {
    vi.mocked(allowRateLimit).mockReturnValue(false);
    const req = new Request("https://x");
    const res = rateLimitOr429(req, "api", 1);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const body = await res!.json();
    expect(body).toEqual({ error: "Too many requests" });
  });
});
