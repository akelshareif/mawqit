"use client";

import { PrayerTimesDisplay } from "@/components/prayer-times-display";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDayPrayerRows,
  getNextPrayer,
} from "@/lib/prayer-times";
import { tryParsePrayerPreview } from "@/lib/prayer-preview";
import { useMemo } from "react";

type Props = {
  latitude: string;
  longitude: string;
  timezone: string;
  prayerMethod: string;
};

/**
 * Live preview of prayer times while the user edits location and method (setup / settings).
 */
export function PrayerTimesPreview({
  latitude,
  longitude,
  timezone,
  prayerMethod,
}: Props) {
  const parsed = useMemo(
    () => tryParsePrayerPreview(latitude, longitude, timezone, prayerMethod),
    [latitude, longitude, timezone, prayerMethod],
  );

  const { rows, next } = useMemo(() => {
    if (!parsed) {
      return { rows: null, next: null };
    }
    const { latitude: lat, longitude: lng, timeZone, prayerMethod: method } =
      parsed;
    return {
      rows: getDayPrayerRows(lat, lng, method, timeZone),
      next: getNextPrayer(lat, lng, method, timeZone),
    };
  }, [parsed]);

  const ready = Boolean(parsed && rows && next);

  return (
    <Card aria-labelledby="prayer-preview-title">
      <CardHeader>
        <CardTitle id="prayer-preview-title">Prayer preview</CardTitle>
        <CardDescription>
          Live times for today while you edit location and calculation method
          below.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[26rem]">
        {ready && parsed && rows && next ? (
          <div className="space-y-4">
            <p className="text-sm leading-snug text-muted-foreground">
              {parsed.timeZone} — updates as you edit location and method
            </p>
            <PrayerTimesDisplay
              timeZone={parsed.timeZone}
              next={next}
              rows={rows}
              compact
              showHeading={false}
            />
          </div>
        ) : (
          <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center sm:py-12">
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Enter latitude, longitude, and timezone, then choose a calculation
              method below. Today&apos;s prayer times will appear here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
