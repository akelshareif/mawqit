/**
 * Normalize contact fields before storage / lookup.
 */

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
