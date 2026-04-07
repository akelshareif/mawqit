import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/push/vapid-public-key", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("503 when key missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns public key when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-key-value");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publicKey).toBe("test-key-value");
  });
});
