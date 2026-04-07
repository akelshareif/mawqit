import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhoneE164 } from "./normalize";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@EXAMPLE.com ")).toBe("user@example.com");
  });
});

describe("normalizePhoneE164", () => {
  it("strips spaces and keeps leading +", () => {
    expect(normalizePhoneE164("+1 234 567 8901")).toBe("+12345678901");
  });

  it("throws without +", () => {
    expect(() => normalizePhoneE164("1234567890")).toThrow(/country code/);
  });

  it("throws when too short", () => {
    expect(() => normalizePhoneE164("+123")).toThrow(/too short/);
  });
});
