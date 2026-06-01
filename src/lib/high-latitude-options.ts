/**
 * High-latitude twilight rule options for setup; values map to adhan's
 * `HighLatitudeRule` in prayer-times.ts. Only matters above ~48° latitude, where the
 * sun may not reach the twilight angle that defines Fajr/Isha.
 */
export const HIGH_LATITUDE_OPTIONS = [
  {
    value: "middleofthenight",
    label: "Middle of the Night",
    description: "Fajr/Isha never cross the midpoint between sunset and sunrise",
  },
  {
    value: "seventhofthenight",
    label: "Seventh of the Night",
    description: "Night split into sevenths for Fajr/Isha bounds",
  },
  {
    value: "twilightangle",
    label: "Twilight Angle",
    description: "Fractions derived from the method's twilight angles",
  },
] as const;

export type HighLatitudeRuleValue =
  (typeof HIGH_LATITUDE_OPTIONS)[number]["value"];

const ALLOWED = new Set<string>(HIGH_LATITUDE_OPTIONS.map((o) => o.value));

export function isAllowedHighLatitudeRule(
  value: string,
): value is HighLatitudeRuleValue {
  return ALLOWED.has(value);
}
