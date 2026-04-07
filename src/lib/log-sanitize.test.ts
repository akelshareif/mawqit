import { describe, expect, it } from "vitest";
import { sanitizeLogMeta, sanitizeLogValue } from "./log-sanitize";

describe("sanitizeLogValue", () => {
  it("redacts sensitive keys in objects", () => {
    expect(
      sanitizeLogValue({ authorization: "secret", ok: true }),
    ).toEqual({ authorization: "[redacted]", ok: true });
  });

  it("truncates UUID-like strings", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(sanitizeLogValue(id)).toBe("550e8400…");
  });

  it("redacts long opaque strings (not hex-only)", () => {
    const long = "x".repeat(40);
    expect(sanitizeLogValue(long)).toBe("[redacted]");
  });
});

describe("sanitizeLogMeta", () => {
  it("returns undefined for empty input", () => {
    expect(sanitizeLogMeta(undefined)).toBeUndefined();
    expect(sanitizeLogMeta({})).toEqual({});
  });
});
