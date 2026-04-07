/**
 * Returns parsed inputs for prayer calculation when the user has entered
 * enough to compute times (location + timezone + method string).
 */
export function tryParsePrayerPreview(
  latStr: string,
  lngStr: string,
  tz: string,
  prayerMethod: string,
): { latitude: number; longitude: number; timeZone: string; prayerMethod: string } | null {
  const latitude = Number.parseFloat(latStr);
  const longitude = Number.parseFloat(lngStr);
  const timeZone = tz.trim();
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return null;
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  if (timeZone.length < 2) {
    return null;
  }
  if (!prayerMethod?.trim()) {
    return null;
  }
  return {
    latitude,
    longitude,
    timeZone,
    prayerMethod: prayerMethod.trim(),
  };
}
