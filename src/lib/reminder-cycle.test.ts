import { describe, expect, it } from "vitest";
import { isReminderCycleStale } from "./reminder-cycle";

const baseSession = {
  latitude: 21.4225 as number | null,
  longitude: 39.8262 as number | null,
  timezone: "UTC" as string | null,
  prayerMethod: "MuslimWorldLeague",
};

describe("isReminderCycleStale", () => {
  it("is stale when coordinates or timezone missing", () => {
    expect(
      isReminderCycleStale(
        { ...baseSession, latitude: null },
        { prayerName: "fajr", prayerDate: new Date("2025-06-15T12:00:00.000Z") },
        new Date("2025-06-15T18:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("is stale when cycle calendar day differs from today in tz", () => {
    expect(
      isReminderCycleStale(
        baseSession,
        { prayerName: "fajr", prayerDate: new Date("2020-01-01T00:00:00.000Z") },
        new Date("2025-06-15T12:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
