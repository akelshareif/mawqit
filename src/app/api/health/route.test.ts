import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

import { getPrisma } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getPrisma).mockReset();
  });

  it("skips database when DATABASE_URL unset", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.database).toBe("skipped");
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it("returns ok when query succeeds", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/db");
    const queryRaw = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getPrisma).mockReturnValue({ $queryRaw: queryRaw } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.database).toBe("ok");
  });

  it("returns 503 when query throws", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/db");
    vi.mocked(getPrisma).mockReturnValue({
      $queryRaw: vi.fn().mockRejectedValue(new Error("db down")),
    } as never);
    const res = await GET();
    expect(res.status).toBe(503);
  });
});
