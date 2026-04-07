import {
  CalculationMethod,
  Coordinates,
  Prayer,
  PrayerTimes,
} from "adhan";

export type PrayerClockRow = {
  key: string;
  label: string;
  time: Date;
};

export type NextPrayerInfo = {
  key: string;
  label: string;
  time: Date;
};

/** Map stored `prayer_method` strings to adhan parameters. */
export function getCalculationParameters(prayerMethod: string) {
  switch (prayerMethod) {
    case "MuslimWorldLeague":
      return CalculationMethod.MuslimWorldLeague();
    case "ISNA":
      return CalculationMethod.NorthAmerica();
    case "Egyptian":
      return CalculationMethod.Egyptian();
    case "UmmAlQura":
      return CalculationMethod.UmmAlQura();
    case "NorthAmerica":
      return CalculationMethod.MoonsightingCommittee();
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

/**
 * Calendar day used for solar calculations, expressed as UTC noon for the
 * user's Y/M/D in `timeZone` (works when the Node runtime uses UTC, e.g. Vercel).
 */
export function resolvePrayerDate(
  timeZone: string,
  instant: Date = new Date(),
): Date {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = dtf.formatToParts(instant);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    if (!year || !month || !day) {
      throw new Error("invalid parts");
    }
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  } catch {
    return new Date(
      Date.UTC(
        instant.getUTCFullYear(),
        instant.getUTCMonth(),
        instant.getUTCDate(),
        12,
        0,
        0,
      ),
    );
  }
}

function addUtcDays(d: Date, days: number): Date {
  const t = new Date(d.getTime());
  t.setUTCDate(t.getUTCDate() + days);
  return t;
}

const PRAYER_LABEL: Record<string, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

function labelForPrayerKey(key: string): string {
  return PRAYER_LABEL[key] ?? key;
}

export function formatClockInTimeZone(
  date: Date,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function getDayPrayerRows(
  latitude: number,
  longitude: number,
  prayerMethod: string,
  timeZone: string,
  day: Date = resolvePrayerDate(timeZone),
): PrayerClockRow[] {
  const coords = new Coordinates(latitude, longitude);
  const params = getCalculationParameters(prayerMethod);
  const pt = new PrayerTimes(coords, day, params);

  return [
    { key: "fajr", label: "Fajr", time: pt.fajr },
    { key: "sunrise", label: "Sunrise", time: pt.sunrise },
    { key: "dhuhr", label: "Dhuhr", time: pt.dhuhr },
    { key: "asr", label: "Asr", time: pt.asr },
    { key: "maghrib", label: "Maghrib", time: pt.maghrib },
    { key: "isha", label: "Isha", time: pt.isha },
  ];
}

export function getNextPrayer(
  latitude: number,
  longitude: number,
  prayerMethod: string,
  timeZone: string,
  now: Date = new Date(),
): NextPrayerInfo {
  const coords = new Coordinates(latitude, longitude);
  const params = getCalculationParameters(prayerMethod);
  const day = resolvePrayerDate(timeZone, now);
  const pt = new PrayerTimes(coords, day, params);
  const nextKey = pt.nextPrayer(now);

  if (nextKey === Prayer.None) {
    const tomorrow = addUtcDays(day, 1);
    const ptNext = new PrayerTimes(coords, tomorrow, params);
    return {
      key: "fajr",
      label: "Fajr",
      time: ptNext.fajr,
    };
  }

  return {
    key: nextKey,
    label: labelForPrayerKey(nextKey),
    time: pt.timeForPrayer(nextKey)!,
  };
}
