import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cron-auth", () => ({
  verifyCronSecret: vi.fn(() => false),
}));

import { verifyCronSecret } from "@/lib/cron-auth";
import { GET } from "./route";

describe("GET /api/cron/reminders", () => {
  it("returns 401 when secret invalid", async () => {
    const req = new Request("http://localhost/api/cron/reminders");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(verifyCronSecret).toHaveBeenCalled();
  });
});
