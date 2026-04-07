/**
 * IANA time zones for the Americas (short dropdown). US, Canada, Mexico, Puerto Rico, Hawaii.
 * Any valid IANA name still works via “Enter manually”.
 */
export const CURATED_IANA_TIME_ZONES: string[] = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/Mexico_City",
  "America/Puerto_Rico",
];

export function isCuratedTimezone(zone: string): boolean {
  return CURATED_IANA_TIME_ZONES.includes(zone);
}

export type TimeZoneRegionGroup = { region: string; zones: string[] };

/** Groups e.g. `America/New_York` under `America`. */
export function groupTimeZonesByRegion(
  zones: string[],
): TimeZoneRegionGroup[] {
  const map = new Map<string, string[]>();
  for (const z of zones) {
    const region = z.includes("/") ? z.slice(0, z.indexOf("/")) : "Other";
    const list = map.get(region) ?? [];
    list.push(z);
    map.set(region, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.localeCompare(b));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, z]) => ({ region, zones: z }));
}
