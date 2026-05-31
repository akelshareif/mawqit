import { BrowserPushHint } from "@/components/browser-push-hint";
import { PrayerTimesDisplay } from "@/components/prayer-times-display";
import { ShareSessionCard } from "@/components/share-session-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPrisma } from "@/lib/db";
import { getDayPrayerRows, getNextPrayer } from "@/lib/prayer-times";
import { sessionUrl } from "@/lib/public-url";
import { isSessionIdFormat } from "@/lib/session-id";
import { activeLocation } from "@/lib/session-targets";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ sessionId: string }> };

function daysUntilExpiry(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function DashboardIncompletePlaceholder({ sessionId }: { sessionId: string }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>
            Save your location under Location &amp; Reminders to see
            today&apos;s prayer times here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="overflow-hidden rounded-2xl border border-dashed border-border/60 bg-muted/20 p-5 sm:p-6">
            <div className="space-y-3 animate-pulse" aria-hidden>
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-9 w-36 rounded-lg bg-muted" />
              <div className="grid gap-2.5 pt-4">
                {["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="h-3.5 w-14 rounded bg-muted" />
                    <div className="h-3.5 w-16 rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your session link</CardTitle>
          <CardDescription>
            After your location is saved, your personal link will appear here so
            you can bookmark or copy it on any device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border/50 bg-muted/30 px-3 py-4">
            <div
              className="h-4 max-w-md animate-pulse rounded bg-muted/70"
              aria-hidden
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-xl"
            disabled
          >
            Copy link
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild className="h-11 rounded-xl">
          <Link href={`/s/${sessionId}/settings`}>Location &amp; Reminders</Link>
        </Button>
      </div>
    </>
  );
}

export default async function DashboardPage({ params }: PageProps) {
  const { sessionId } = await params;
  if (!isSessionIdFormat(sessionId)) {
    notFound();
  }

  const session = await getPrisma().session.findUnique({
    where: { id: sessionId },
    include: { savedLocations: { where: { isActive: true }, take: 1 } },
  });
  if (!session) {
    notFound();
  }

  const loc = activeLocation(session.savedLocations);
  const tzRaw = loc?.timezone?.trim();
  const lat = loc?.latitude ?? null;
  const lng = loc?.longitude ?? null;
  if (lat == null || lng == null || !tzRaw) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
        <DashboardIncompletePlaceholder sessionId={sessionId} />
      </main>
    );
  }

  const pushCount = await getPrisma().pushSubscription.count({
    where: { sessionId },
  });
  const showBrowserPushHint =
    session.browserNotificationsEnabled && pushCount === 0;

  const tz = tzRaw;
  const rows = getDayPrayerRows(
    lat,
    lng,
    session.prayerMethod,
    tz,
  );
  const next = getNextPrayer(
    lat,
    lng,
    session.prayerMethod,
    tz,
  );
  const link = sessionUrl(sessionId);
  const renewDays = daysUntilExpiry(session.expiresAt);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      {showBrowserPushHint ? (
        <BrowserPushHint sessionId={sessionId} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>
            Prayer times for your saved location ({tz}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <PrayerTimesDisplay
            timeZone={tz}
            next={next}
            rows={rows}
            showHeading={false}
          />
        </CardContent>
      </Card>

      <ShareSessionCard
        url={link}
        sessionId={sessionId}
        daysUntilRenewal={renewDays}
      />

      <div className="flex flex-wrap gap-3">
        <Button asChild className="h-11 rounded-xl">
          <Link href={`/s/${sessionId}/settings`}>Location &amp; Reminders</Link>
        </Button>
      </div>
    </main>
  );
}
