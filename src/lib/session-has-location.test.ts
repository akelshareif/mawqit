import { describe, expect, it } from "vitest";
import { sessionHasSavedLocation } from "./session-has-location";

describe("sessionHasSavedLocation", () => {
  it("returns true when an active location with coords and timezone is present", () => {
    expect(
      sessionHasSavedLocation({
        savedLocations: [
          { latitude: 40.7, longitude: -74, timezone: "America/New_York" },
        ],
      }),
    ).toBe(true);
  });

  it("returns false when there is no active location", () => {
    expect(sessionHasSavedLocation({ savedLocations: [] })).toBe(false);
  });

  it("returns false when the active location's timezone is blank", () => {
    expect(
      sessionHasSavedLocation({
        savedLocations: [{ latitude: 40.7, longitude: -74, timezone: "" }],
      }),
    ).toBe(false);
  });
});
