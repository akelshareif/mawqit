import type { PrayerTimes } from "adhan";

/** Five daily prayers (excludes sunrise). */
export const SALAH_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export function prayerTimeForKey(pt: PrayerTimes, key: string): Date {
  switch (key) {
    case "fajr":
      return pt.fajr;
    case "dhuhr":
      return pt.dhuhr;
    case "asr":
      return pt.asr;
    case "maghrib":
      return pt.maghrib;
    case "isha":
      return pt.isha;
    default:
      return pt.fajr;
  }
}

export function labelForKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Next prayer in the same day after `key`, or `null` after `isha` (next is Fajr next day). */
export function nextPrayerKeyAfter(
  key: string,
): (typeof SALAH_KEYS)[number] | null {
  const idx = SALAH_KEYS.indexOf(key as (typeof SALAH_KEYS)[number]);
  if (idx < 0 || idx >= SALAH_KEYS.length - 1) {
    return null;
  }
  return SALAH_KEYS[idx + 1];
}
