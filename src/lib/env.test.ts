import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCronIntervalMinutes,
  getEnableDebugTools,
  getLearnToPrayUrl,
  getQaReminderClockOffsetMinutes,
  getReminderNow,
  getSessionExpiryWarningDays,
  getSessionValidityDays,
  getVapidSubject,
  getWebPushMode,
  isQaReminderClockEnabled,
} from "./env";

describe("env getters", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getSessionValidityDays defaults and parses", () => {
    expect(getSessionValidityDays()).toBe(30);
    vi.stubEnv("SESSION_VALIDITY_DAYS", "14");
    expect(getSessionValidityDays()).toBe(14);
    vi.stubEnv("SESSION_VALIDITY_DAYS", "0");
    expect(getSessionValidityDays()).toBe(30);
  });

  it("getSessionExpiryWarningDays defaults and parses", () => {
    expect(getSessionExpiryWarningDays()).toBe(3);
    vi.stubEnv("SESSION_EXPIRY_WARNING_DAYS", "7");
    expect(getSessionExpiryWarningDays()).toBe(7);
  });

  it("getCronIntervalMinutes defaults and parses", () => {
    expect(getCronIntervalMinutes()).toBe(5);
    vi.stubEnv("CRON_INTERVAL_MINUTES", "10");
    expect(getCronIntervalMinutes()).toBe(10);
  });

  it("getWebPushMode returns mock or real", () => {
    expect(getWebPushMode()).toBe("mock");
    vi.stubEnv("WEB_PUSH_MODE", "real");
    expect(getWebPushMode()).toBe("real");
  });

  it("getVapidSubject default", () => {
    expect(getVapidSubject()).toBe("mailto:support@mawqit.local");
    vi.stubEnv("VAPID_SUBJECT", "mailto:me@example.com");
    expect(getVapidSubject()).toBe("mailto:me@example.com");
  });

  it("getLearnToPrayUrl default", () => {
    expect(getLearnToPrayUrl()).toBe("https://example.com/learn-salah");
  });

  it("getEnableDebugTools respects NODE_ENV", () => {
    vi.stubEnv("ENABLE_DEBUG_TOOLS", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(getEnableDebugTools()).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(getEnableDebugTools()).toBe(false);
    vi.stubEnv("ALLOW_DEBUG_TOOLS_IN_PRODUCTION", "true");
    expect(getEnableDebugTools()).toBe(true);
  });

  it("getQaReminderClockOffsetMinutes", () => {
    expect(getQaReminderClockOffsetMinutes()).toBe(0);
    vi.stubEnv("QA_REMINDER_CLOCK_OFFSET_MINUTES", "30");
    expect(getQaReminderClockOffsetMinutes()).toBe(30);
  });

  it("isQaReminderClockEnabled and getReminderNow", () => {
    const base = new Date("2025-01-01T12:00:00.000Z");
    vi.stubEnv("ENABLE_QA_REMINDER_CLOCK", "false");
    vi.stubEnv("ENABLE_DEBUG_TOOLS", "false");
    expect(isQaReminderClockEnabled()).toBe(false);
    expect(getReminderNow(base)).toEqual(base);

    vi.stubEnv("ENABLE_QA_REMINDER_CLOCK", "true");
    vi.stubEnv("QA_REMINDER_CLOCK_OFFSET_MINUTES", "60");
    expect(isQaReminderClockEnabled()).toBe(true);
    expect(getReminderNow(base).getTime()).toBe(
      base.getTime() + 60 * 60_000,
    );
  });
});
