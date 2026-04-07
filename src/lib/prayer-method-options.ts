/** Labels for setup; values align with `adhan` in slice 3 (`lib/prayer-times.ts`). */
export const PRAYER_METHOD_OPTIONS = [
  {
    value: "MuslimWorldLeague",
    label: "Muslim World League",
    description: "Common in Europe, Far East, parts of Americas",
  },
  {
    value: "ISNA",
    label: "ISNA",
    description: "Islamic Society of North America",
  },
  {
    value: "Egyptian",
    label: "Egyptian",
    description: "Used in Africa, Syria, Iraq",
  },
  {
    value: "UmmAlQura",
    label: "Umm Al-Qura",
    description: "Used in Saudi Arabia",
  },
  {
    value: "NorthAmerica",
    label: "Moonsighting Committee (North America)",
    description: "North America (moonsighting)",
  },
] as const;

export type PrayerMethodValue = (typeof PRAYER_METHOD_OPTIONS)[number]["value"];

const ALLOWED = new Set<string>(
  PRAYER_METHOD_OPTIONS.map((o) => o.value),
);

export function isAllowedPrayerMethod(value: string): value is PrayerMethodValue {
  return ALLOWED.has(value);
}
