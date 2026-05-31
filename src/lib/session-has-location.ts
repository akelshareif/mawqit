import { activeLocation } from "@/lib/session-targets";

/**
 * True when the session has an active saved location (coordinates + timezone), i.e.
 * prayer-time calculation is possible. Used to gate browser-push setup UI.
 */
export function sessionHasSavedLocation(session: {
  savedLocations: { latitude: number; longitude: number; timezone: string }[];
}): boolean {
  const loc = activeLocation(session.savedLocations);
  return Boolean(loc && Boolean(loc.timezone?.trim()));
}
