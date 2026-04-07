import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowRateLimit } from "./rate-limit-memory";

describe("allowRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request and counts within window", () => {
    const key = `rl-test-${Math.random()}`;
    expect(allowRateLimit(key, 2, 60_000)).toBe(true);
    expect(allowRateLimit(key, 2, 60_000)).toBe(true);
    expect(allowRateLimit(key, 2, 60_000)).toBe(false);
  });

  it("resets after window", () => {
    const key = `rl-test-${Math.random()}`;
    expect(allowRateLimit(key, 1, 60_000)).toBe(true);
    expect(allowRateLimit(key, 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(allowRateLimit(key, 1, 60_000)).toBe(true);
  });
});
