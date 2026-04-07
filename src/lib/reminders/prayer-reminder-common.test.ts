import { Coordinates, PrayerTimes } from "adhan";
import { describe, expect, it } from "vitest";
import { parseUtcDateFromYmd } from "@/lib/calendar-date";
import { getCalculationParameters } from "@/lib/prayer-times";
import {
  labelForKey,
  nextPrayerKeyAfter,
  prayerTimeForKey,
  SALAH_KEYS,
} from "./prayer-reminder-common";

describe("nextPrayerKeyAfter", () => {
  it("returns next salah in order", () => {
    expect(nextPrayerKeyAfter("fajr")).toBe("dhuhr");
    expect(nextPrayerKeyAfter("isha")).toBe(null);
  });

  it("returns null for unknown key", () => {
    expect(nextPrayerKeyAfter("unknown")).toBe(null);
  });
});

describe("labelForKey", () => {
  it("capitalizes", () => {
    expect(labelForKey("fajr")).toBe("Fajr");
  });
});

describe("prayerTimeForKey", () => {
  it("maps keys to PrayerTimes fields", () => {
    const day = parseUtcDateFromYmd("2025-06-15");
    const coords = new Coordinates(21.4225, 39.8262);
    const pt = new PrayerTimes(
      coords,
      day,
      getCalculationParameters("MuslimWorldLeague"),
    );
    expect(prayerTimeForKey(pt, "fajr")).toEqual(pt.fajr);
    expect(prayerTimeForKey(pt, "bad")).toEqual(pt.fajr);
  });
});

describe("SALAH_KEYS", () => {
  it("has five entries", () => {
    expect(SALAH_KEYS).toHaveLength(5);
  });
});
