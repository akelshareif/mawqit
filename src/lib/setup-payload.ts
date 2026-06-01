import { normalizeEmail } from "@/lib/normalize";
import { isAllowedPrayerMethod } from "@/lib/prayer-method-options";
import { isAllowedAsrMethod } from "@/lib/asr-method-options";
import { isAllowedHighLatitudeRule } from "@/lib/high-latitude-options";

const CADENCE = new Set([5, 15, 30]);
const FOLLOWUP = new Set([15, 30, 60]);

export type SetupPayload = {
  latitude: number;
  longitude: number;
  timezone: string;
  emailEnabled: boolean;
  emailAddress: string | null;
  browserNotificationsEnabled: boolean;
  persistentReminders: boolean;
  persistenceCadenceMinutes: number;
  followupEnabled: boolean;
  followupDelayMinutes: number;
  prayerMethod: string;
  asrMethod: string;
  highLatitudeRule: string;
};

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseSetupPayload(
  json: unknown,
): { ok: true; data: SetupPayload } | { ok: false; error: string } {
  if (!json || typeof json !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const o = json as Record<string, unknown>;

  const lat = asNum(o.latitude);
  const lng = asNum(o.longitude);
  const timezone =
    typeof o.timezone === "string" ? o.timezone.trim() : "";

  if (lat === null || lat < -90 || lat > 90) {
    return { ok: false, error: "Latitude must be between -90 and 90." };
  }
  if (lng === null || lng < -180 || lng > 180) {
    return { ok: false, error: "Longitude must be between -180 and 180." };
  }
  if (timezone.length < 2 || timezone.length > 128) {
    return {
      ok: false,
      error:
        "Timezone must be a valid IANA name (e.g. America/New_York), 2–128 characters.",
    };
  }

  const emailEnabled = asBool(o.emailEnabled) ?? false;
  const browserNotificationsEnabled =
    asBool(o.browserNotificationsEnabled) ?? false;

  if (!emailEnabled && !browserNotificationsEnabled) {
    return {
      ok: false,
      error:
        "Add at least one notification channel (email or browser).",
    };
  }

  let emailAddress: string | null = null;
  if (emailEnabled) {
    const raw =
      typeof o.emailAddress === "string" ? o.emailAddress.trim() : "";
    if (!raw) {
      return { ok: false, error: "Email is required when email is enabled." };
    }
    emailAddress = normalizeEmail(raw);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
  }

  const persistentReminders = asBool(o.persistentReminders) ?? true;
  const persistenceCadenceMinutes = asNum(o.persistenceCadenceMinutes);
  if (
    persistenceCadenceMinutes === null ||
    !CADENCE.has(persistenceCadenceMinutes)
  ) {
    return {
      ok: false,
      error: "Persistence cadence must be 5, 15, or 30 minutes.",
    };
  }

  const followupEnabled = asBool(o.followupEnabled) ?? false;
  const followupDelayMinutes = asNum(o.followupDelayMinutes);
  if (
    followupDelayMinutes === null ||
    !FOLLOWUP.has(followupDelayMinutes)
  ) {
    return {
      ok: false,
      error: "Follow-up delay must be 15, 30, or 60 minutes.",
    };
  }

  const prayerMethod =
    typeof o.prayerMethod === "string" ? o.prayerMethod.trim() : "";
  if (!isAllowedPrayerMethod(prayerMethod)) {
    return { ok: false, error: "Select a valid prayer calculation method." };
  }

  // Asr method and high-latitude rule default to adhan's own defaults when omitted,
  // so older clients that don't send them keep the pre-1.3 behavior.
  const asrMethodRaw =
    typeof o.asrMethod === "string" ? o.asrMethod.trim() : "standard";
  const asrMethod = asrMethodRaw === "" ? "standard" : asrMethodRaw;
  if (!isAllowedAsrMethod(asrMethod)) {
    return { ok: false, error: "Select a valid Asr method." };
  }

  const highLatitudeRuleRaw =
    typeof o.highLatitudeRule === "string"
      ? o.highLatitudeRule.trim()
      : "middleofthenight";
  const highLatitudeRule =
    highLatitudeRuleRaw === "" ? "middleofthenight" : highLatitudeRuleRaw;
  if (!isAllowedHighLatitudeRule(highLatitudeRule)) {
    return { ok: false, error: "Select a valid high-latitude rule." };
  }

  return {
    ok: true,
    data: {
      latitude: lat,
      longitude: lng,
      timezone,
      emailEnabled,
      emailAddress,
      browserNotificationsEnabled,
      persistentReminders,
      persistenceCadenceMinutes,
      followupEnabled,
      followupDelayMinutes,
      prayerMethod,
      asrMethod,
      highLatitudeRule,
    },
  };
}
