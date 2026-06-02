/**
 * Normalize contact fields before storage / lookup.
 */

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Pull the bare address out of an RFC 5322 `From` value. Inbound providers send
 * the full header (`Name <addr@x>` or `<addr@x>`); we match on the bare address.
 * Returns the trimmed input unchanged when there are no angle brackets.
 */
export function extractEmailAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return (match ? match[1] : headerValue).trim();
}
