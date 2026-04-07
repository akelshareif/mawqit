import { describe, expect, it } from "vitest";
import {
  isAllowedPrayerMethod,
  PRAYER_METHOD_OPTIONS,
} from "./prayer-method-options";

describe("prayer-method-options", () => {
  it("has known values", () => {
    expect(PRAYER_METHOD_OPTIONS.length).toBeGreaterThan(0);
    expect(PRAYER_METHOD_OPTIONS.map((o) => o.value)).toContain(
      "MuslimWorldLeague",
    );
  });

  it("isAllowedPrayerMethod validates", () => {
    expect(isAllowedPrayerMethod("MuslimWorldLeague")).toBe(true);
    expect(isAllowedPrayerMethod("Invalid")).toBe(false);
  });
});
