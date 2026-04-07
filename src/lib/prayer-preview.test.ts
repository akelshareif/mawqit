import { describe, expect, it } from "vitest";
import { tryParsePrayerPreview } from "./prayer-preview";

describe("tryParsePrayerPreview", () => {
  it("returns null for invalid lat/lng/tz", () => {
    expect(tryParsePrayerPreview("", "0", "UTC", "MuslimWorldLeague")).toBeNull();
    expect(tryParsePrayerPreview("91", "0", "UTC", "MuslimWorldLeague")).toBeNull();
    expect(tryParsePrayerPreview("40", "0", " ", "MuslimWorldLeague")).toBeNull();
  });

  it("parses valid inputs", () => {
    const r = tryParsePrayerPreview(
      "40.7",
      "-74",
      " America/New_York ",
      "MuslimWorldLeague",
    );
    expect(r).toEqual({
      latitude: 40.7,
      longitude: -74,
      timeZone: "America/New_York",
      prayerMethod: "MuslimWorldLeague",
    });
  });
});
