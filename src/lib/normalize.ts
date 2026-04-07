/**
 * Normalize contact fields before storage / lookup.
 */

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Expects E.164 with leading + and country code. Whitespace is stripped.
 */
export function normalizePhoneE164(input: string): string {
  const compact = input.trim().replace(/\s/g, "");
  if (!compact.startsWith("+")) {
    throw new Error(
      "Phone number must include country code, e.g. +1234567890",
    );
  }
  if (compact.length < 8) {
    throw new Error("Phone number looks too short.");
  }
  return compact;
}
