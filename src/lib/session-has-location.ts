/**
 * True when the session has been saved at least once with coordinates + timezone
 * (same gate as dashboard / session root).
 */
export function sessionHasSavedLocation(session: {
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}): boolean {
  return (
    session.latitude != null &&
    session.longitude != null &&
    Boolean(session.timezone?.trim())
  );
}
