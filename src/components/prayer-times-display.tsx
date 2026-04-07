import type { NextPrayerInfo, PrayerClockRow } from "@/lib/prayer-times";
import { formatClockInTimeZone } from "@/lib/prayer-times";
import { cn } from "@/lib/utils";

type Props = {
  timeZone: string;
  next: NextPrayerInfo;
  rows: PrayerClockRow[];
  /** Smaller padding when embedded in setup */
  compact?: boolean;
  /** Optional title override */
  title?: string;
  /** Optional subtitle (e.g. zone name) */
  subtitle?: string;
  /** When false, only the next-prayer hero + grid (page supplies its own heading). */
  showHeading?: boolean;
};

/**
 * Shared layout for today’s prayer times — mobile-first, readable tap targets.
 */
export function PrayerTimesDisplay({
  timeZone,
  next,
  rows,
  compact = false,
  title = "Today",
  subtitle,
  showHeading = true,
}: Props) {
  const sub =
    subtitle ?? `Times in ${timeZone} — ${new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(new Date())}`;

  return (
    <div className={cn("space-y-4", compact ? "" : "space-y-6")}>
      {showHeading ? (
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
          <p className="text-sm leading-snug text-muted-foreground">{sub}</p>
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs",
          compact ? "p-4" : "p-5 sm:p-6",
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Next
        </p>
        <p className="mt-1 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {next.label}
        </p>
        <p className="mt-1 text-2xl tabular-nums text-foreground/90 sm:text-3xl">
          {formatClockInTimeZone(next.time, timeZone)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex min-h-[3.25rem] items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-xs"
          >
            <span className="font-medium text-foreground">{row.label}</span>
            <span className="shrink-0 tabular-nums text-base text-muted-foreground">
              {formatClockInTimeZone(row.time, timeZone)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
