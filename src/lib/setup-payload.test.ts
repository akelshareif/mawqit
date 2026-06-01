import { describe, expect, it } from "vitest";
import { parseSetupPayload } from "./setup-payload";

const validBase = {
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
  emailEnabled: true,
  emailAddress: "user@example.com",
  browserNotificationsEnabled: false,
  persistentReminders: true,
  persistenceCadenceMinutes: 15,
  followupEnabled: false,
  followupDelayMinutes: 15,
  prayerMethod: "MuslimWorldLeague",
};

describe("parseSetupPayload", () => {
  it("accepts a valid payload", () => {
    const r = parseSetupPayload(validBase);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.emailAddress).toBe("user@example.com");
      expect(r.data.prayerMethod).toBe("MuslimWorldLeague");
    }
  });

  it("rejects non-object body", () => {
    expect(parseSetupPayload(null).ok).toBe(false);
  });

  it("rejects when no channel enabled", () => {
    const r = parseSetupPayload({
      ...validBase,
      emailEnabled: false,
      browserNotificationsEnabled: false,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid cadence", () => {
    const r = parseSetupPayload({
      ...validBase,
      persistenceCadenceMinutes: 99,
    });
    expect(r.ok).toBe(false);
  });
});
