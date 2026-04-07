/** Loose UUID shape for route params (avoids useless DB hits on junk ids). */
const UUID_LIKE =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function isSessionIdFormat(id: string): boolean {
  return UUID_LIKE.test(id);
}
