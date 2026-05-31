"use client";

import { cn } from "@/lib/class-names";
import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass =
  "inline-block shrink-0 text-sm no-underline outline-none transition-colors focus-visible:outline-none focus-visible:ring-0";

/** Normalize for stable comparisons (trailing slash, etc.). */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

type Props = {
  sessionId: string;
  showDebug: boolean;
};

export function SessionSubnav({ sessionId, showDebug }: Props) {
  const pathname = usePathname();
  const base = `/s/${sessionId}`;
  const dashboardPath = `${base}/dashboard`;
  const path = normalizePath(pathname);

  const onToday = path === dashboardPath || path === base;
  const onLocationReminders =
    path === `${base}/settings` || path === `${base}/setup`;
  const onDebug = path === `${base}/debug`;
  const homeAriaCurrent = onToday;

  const navInactive =
    "font-medium text-muted-foreground hover:text-foreground";
  const navActive = "font-bold text-foreground";

  return (
    <nav
      aria-label="Session"
      className="border-b border-border/40 bg-background/70 px-6 py-4 backdrop-blur-sm"
    >
      <div className="mx-auto flex min-h-11 max-w-2xl flex-nowrap items-center gap-x-5 sm:gap-x-8">
        <Link
          href={dashboardPath}
          className="inline-block shrink-0 font-heading text-lg font-semibold tracking-tight text-primary no-underline outline-none transition-colors hover:text-primary/90 dark:text-sky-400 dark:hover:text-sky-300 focus-visible:outline-none focus-visible:ring-0"
        >
          Mawqit
        </Link>

        <Link
          href={dashboardPath}
          aria-current={homeAriaCurrent ? "page" : undefined}
          className={cn(linkClass, onToday ? navActive : navInactive)}
        >
          Home
        </Link>

        <Link
          href={`${base}/settings`}
          aria-current={onLocationReminders ? "page" : undefined}
          className={cn(linkClass, onLocationReminders ? navActive : navInactive)}
        >
          Location & Reminders
        </Link>

        {showDebug ? (
          <Link
            href={`${base}/debug`}
            aria-current={onDebug ? "page" : undefined}
            className={cn(linkClass, onDebug ? navActive : navInactive)}
          >
            Debug
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
