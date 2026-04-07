import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCronSecret } from "./cron-auth";

describe("verifyCronSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronSecret(null)).toBe(false);
    expect(verifyCronSecret("Bearer x")).toBe(false);
  });

  it("returns true for exact Bearer match", () => {
    vi.stubEnv("CRON_SECRET", "secret-token");
    expect(verifyCronSecret("Bearer secret-token")).toBe(true);
  });

  it("returns false for wrong token or length mismatch", () => {
    vi.stubEnv("CRON_SECRET", "secret-token");
    expect(verifyCronSecret("Bearer wrong")).toBe(false);
    expect(verifyCronSecret("Bearer secret-token-extra")).toBe(false);
  });
});
