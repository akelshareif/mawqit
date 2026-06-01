import { describe, expect, it } from "vitest";
import {
  formatClockInTimeZone,
  getCalculationParameters,
  getDayPrayerRows,
  resolvePrayerDate,
} from "./prayer-times";

const NYC = { lat: 40.7128, lng: -74.006 };

function asrFor(asrMethod: string): Date {
  const rows = getDayPrayerRows(
    NYC.lat,
    NYC.lng,
    { prayerMethod: "MuslimWorldLeague", asrMethod },
    "America/New_York",
    resolvePrayerDate("America/New_York", new Date("2025-06-15T12:00:00.000Z")),
  );
  return rows.find((r) => r.key === "asr")!.time;
}

describe("getCalculationParameters", () => {
  it("maps known methods and falls back for unknown", () => {
    expect(getCalculationParameters({ prayerMethod: "MuslimWorldLeague" })).toBeDefined();
    expect(getCalculationParameters({ prayerMethod: "ISNA" })).toBeDefined();
    expect(getCalculationParameters({ prayerMethod: "unknown" })).toBeDefined();
  });

  it("defaults to standard Asr (Shafi) and middle-of-night high-latitude rule", () => {
    const params = getCalculationParameters({ prayerMethod: "MuslimWorldLeague" });
    expect(params.madhab).toBe("shafi");
    expect(params.highLatitudeRule).toBe("middleofthenight");
  });

  it("applies the Hanafi madhab when asked", () => {
    const params = getCalculationParameters({
      prayerMethod: "MuslimWorldLeague",
      asrMethod: "hanafi",
    });
    expect(params.madhab).toBe("hanafi");
  });
});

describe("Asr juristic method", () => {
  it("computes a later Asr for Hanafi than for standard", () => {
    const standard = asrFor("standard");
    const hanafi = asrFor("hanafi");
    expect(hanafi.getTime()).toBeGreaterThan(standard.getTime());
  });
});

describe("DST transitions (America/New_York)", () => {
  // Solar noon is continuous; the local clock jumps. Dhuhr should read ~midday
  // local time on both sides of each transition, proving we key off the calendar
  // day in the user's zone rather than a fixed UTC offset.
  function dhuhrLocal(day: Date): string {
    const rows = getDayPrayerRows(
      NYC.lat,
      NYC.lng,
      { prayerMethod: "MuslimWorldLeague" },
      "America/New_York",
      day,
    );
    return formatClockInTimeZone(
      rows.find((r) => r.key === "dhuhr")!.time,
      "America/New_York",
    );
  }

  it("keeps Dhuhr near midday across spring-forward (2025-03-09)", () => {
    // EST the day before, EDT the day after — both should be early afternoon local.
    expect(dhuhrLocal(new Date(Date.UTC(2025, 2, 8, 12)))).toMatch(/^12:\d\d/);
    expect(dhuhrLocal(new Date(Date.UTC(2025, 2, 10, 12)))).toMatch(/^1:\d\d/);
  });

  it("keeps Dhuhr near midday across fall-back (2025-11-02)", () => {
    expect(dhuhrLocal(new Date(Date.UTC(2025, 10, 1, 12)))).toMatch(/^12:\d\d/);
    expect(dhuhrLocal(new Date(Date.UTC(2025, 10, 3, 12)))).toMatch(/^11:\d\d/);
  });
});

describe("high-latitude rule", () => {
  // Reykjavík, 2025-05-01: civil dawn never reaches the Fajr angle, so the rule
  // chooses the fallback. Different rules yield materially different Fajr times.
  const REYK = { lat: 64.1265, lng: -21.8174 };
  const day = new Date(Date.UTC(2025, 4, 1, 12));

  function fajrFor(highLatitudeRule: string): Date {
    const rows = getDayPrayerRows(
      REYK.lat,
      REYK.lng,
      { prayerMethod: "MuslimWorldLeague", highLatitudeRule },
      "Atlantic/Reykjavik",
      day,
    );
    return rows.find((r) => r.key === "fajr")!.time;
  }

  it("produces valid, differing Fajr times per rule", () => {
    const mid = fajrFor("middleofthenight");
    const seventh = fajrFor("seventhofthenight");
    expect(Number.isNaN(mid.getTime())).toBe(false);
    expect(Number.isNaN(seventh.getTime())).toBe(false);
    expect(mid.getTime()).not.toBe(seventh.getTime());
  });
});

describe("resolvePrayerDate", () => {
  it("returns UTC noon for calendar day in timezone", () => {
    const instant = new Date("2025-06-15T08:00:00.000Z");
    const d = resolvePrayerDate("America/New_York", instant);
    expect(d.getUTCHours()).toBe(12);
  });
});
