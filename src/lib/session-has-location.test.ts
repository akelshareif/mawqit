import { describe, expect, it } from "vitest";
import { sessionHasSavedLocation } from "./session-has-location";

describe("sessionHasSavedLocation", () => {
  it("is false when coordinates or timezone missing", () => {
    expect(
      sessionHasSavedLocation({
        latitude: 1,
        longitude: 2,
        timezone: null,
      }),
    ).toBe(false);
    expect(
      sessionHasSavedLocation({
        latitude: null,
        longitude: 2,
        timezone: "UTC",
      }),
    ).toBe(false);
  });

  it("is true when all required fields are set", () => {
    expect(
      sessionHasSavedLocation({
        latitude: 40,
        longitude: -74,
        timezone: "America/New_York",
      }),
    ).toBe(true);
  });
});
