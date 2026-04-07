/** Calendar YYYY-MM-DD string in a given IANA time zone. */
export function formatDateInTimeZone(
  instant: Date,
  timeZone: string,
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/** Parse `YYYY-MM-DD` to UTC midnight for Prisma `@db.Date`. */
export function parseUtcDateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) {
    return new Date(ymd);
  }
  return new Date(Date.UTC(y, m - 1, d));
}
