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

  it("defaults asr method and high-latitude rule when omitted", () => {
    const r = parseSetupPayload(validBase);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.asrMethod).toBe("standard");
      expect(r.data.highLatitudeRule).toBe("middleofthenight");
    }
  });

  it("accepts hanafi asr and a non-default high-latitude rule", () => {
    const r = parseSetupPayload({
      ...validBase,
      asrMethod: "hanafi",
      highLatitudeRule: "seventhofthenight",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.asrMethod).toBe("hanafi");
      expect(r.data.highLatitudeRule).toBe("seventhofthenight");
    }
  });

  it("rejects an invalid asr method", () => {
    const r = parseSetupPayload({ ...validBase, asrMethod: "jafari" });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid high-latitude rule", () => {
    const r = parseSetupPayload({ ...validBase, highLatitudeRule: "nonsense" });
    expect(r.ok).toBe(false);
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
