import { RecipientType } from "@/generated/prisma/enums";

/**
 * Helpers for reading a session's active location and primary recipients after the
 * Phase 1.4 schema split. Queries load the active location with
 * `savedLocations: { where: { isActive: true }, take: 1 }` and recipients with
 * `recipients: { where: { isPrimary: true } }`; these accessors pick from those arrays.
 */

type LocationRow = { latitude: number; longitude: number; timezone: string };
type RecipientRow = { type: RecipientType; value: string; isPrimary: boolean };

/** The active saved location for a session, or null if none is set. */
export function activeLocation<T extends LocationRow>(locations: T[]): T | null {
  return locations[0] ?? null;
}

/** The primary recipient value (email address or phone) for a channel, or null. */
export function primaryRecipientValue(
  recipients: RecipientRow[],
  type: RecipientType,
): string | null {
  return recipients.find((r) => r.type === type && r.isPrimary)?.value ?? null;
}
