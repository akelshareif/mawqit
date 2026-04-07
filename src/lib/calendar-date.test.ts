import { describe, expect, it } from "vitest";
import { formatDateInTimeZone, parseUtcDateFromYmd } from "./calendar-date";

describe("formatDateInTimeZone", () => {
  it("formats YYYY-MM-DD in a timezone", () => {
    const d = new Date("2025-06-15T00:30:00.000Z");
    expect(formatDateInTimeZone(d, "UTC")).toBe("2025-06-15");
  });
});

describe("parseUtcDateFromYmd", () => {
  it("parses valid YMD to UTC midnight", () => {
    const d = parseUtcDateFromYmd("2025-03-01");
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(1);
  });
});
