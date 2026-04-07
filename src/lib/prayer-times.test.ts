import { describe, expect, it } from "vitest";
import {
  getCalculationParameters,
  resolvePrayerDate,
} from "./prayer-times";

describe("getCalculationParameters", () => {
  it("maps known methods", () => {
    expect(getCalculationParameters("MuslimWorldLeague")).toBeDefined();
    expect(getCalculationParameters("ISNA")).toBeDefined();
    expect(getCalculationParameters("unknown")).toBeDefined();
  });
});

describe("resolvePrayerDate", () => {
  it("returns UTC noon for calendar day in timezone", () => {
    const instant = new Date("2025-06-15T08:00:00.000Z");
    const d = resolvePrayerDate("America/New_York", instant);
    expect(d.getUTCHours()).toBe(12);
  });
});
