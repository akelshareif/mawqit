import { describe, expect, it } from "vitest";
import { isSessionIdFormat } from "./session-id";

describe("isSessionIdFormat", () => {
  it("accepts lowercase UUID", () => {
    expect(
      isSessionIdFormat("550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
  });

  it("accepts uppercase UUID", () => {
    expect(
      isSessionIdFormat("550E8400-E29B-41D4-A716-446655440000"),
    ).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isSessionIdFormat("not-a-uuid")).toBe(false);
    expect(isSessionIdFormat("")).toBe(false);
  });
});
