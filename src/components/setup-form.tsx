"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRAYER_METHOD_OPTIONS } from "@/lib/prayer-method-options";
import {
  CURATED_IANA_TIME_ZONES,
  groupTimeZonesByRegion,
  isCuratedTimezone,
} from "@/lib/timezone-options";
import { BrowserPushHint } from "@/components/browser-push-hint";
import { PrayerTimesPreview } from "@/components/prayer-times-preview";
import { cn } from "@/lib/class-names";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const selectFieldClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

/** Block exponent/plus so coordinates stay plain decimals. */
function blockNonNumericCoordKeys(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "e" || e.key === "E" || e.key === "+") {
    e.preventDefault();
  }
}

export type SetupFormInitial = {
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  emailEnabled: boolean;
  emailAddress: string | null;
  browserNotificationsEnabled: boolean;
  persistentReminders: boolean;
  persistenceCadenceMinutes: number;
  followupEnabled: boolean;
  followupDelayMinutes: number;
  prayerMethod: string;
};

type Props = {
  sessionId: string;
  initial: SetupFormInitial;
  /** Defaults for first-time setup (`/setup`). */
  headingTitle?: string;
  headingDescription?: string;
  /** Show “delete my data” when this session already had location saved (returning user on setup, or settings). */
  showDeleteDataSection?: boolean;
  /** Web Push rows for this session (for showing enable UI on setup/settings). */
  pushSubscriptionCount?: number;
};

export function SetupForm({
  sessionId,
  initial,
  headingTitle = "Set up Reminders",
  headingDescription = "Add your location and how you would like to be notified. You can edit this anytime from your session link.",
  showDeleteDataSection = false,
  pushSubscriptionCount = 0,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [latitude, setLatitude] = useState(
    initial.latitude != null ? String(initial.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    initial.longitude != null ? String(initial.longitude) : "",
  );
  const [timezone, setTimezone] = useState(initial.timezone ?? "");

  const [emailEnabled, setEmailEnabled] = useState(initial.emailEnabled);
  const [emailAddress, setEmailAddress] = useState(initial.emailAddress ?? "");
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(initial.browserNotificationsEnabled);

  const [persistentReminders, setPersistentReminders] = useState(
    initial.persistentReminders,
  );
  const [persistenceCadenceMinutes, setPersistenceCadenceMinutes] = useState(
    String(initial.persistenceCadenceMinutes),
  );
  const [followupEnabled, setFollowupEnabled] = useState(initial.followupEnabled);
  const [followupDelayMinutes, setFollowupDelayMinutes] = useState(
    String(initial.followupDelayMinutes),
  );
  const [prayerMethod, setPrayerMethod] = useState(initial.prayerMethod);
  const [locPending, setLocPending] = useState(false);

  const [useCustomTimezone, setUseCustomTimezone] = useState(() => {
    const t = initial.timezone ?? "";
    return Boolean(t && !isCuratedTimezone(t));
  });

  const curatedTimeZoneGroups = useMemo(
    () => groupTimeZonesByRegion(CURATED_IANA_TIME_ZONES),
    [],
  );

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    setError(null);
    setLocPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) {
            setTimezone(tz);
            setUseCustomTimezone(!isCuratedTimezone(tz));
          }
        } catch {
          /* keep manual timezone */
        }
        setLocPending(false);
      },
      (err) => {
        setLocPending(false);
        setError(
          err.code === 1
            ? "Location permission denied. Enter coordinates manually or try again."
            : "Could not read your location. Enter it manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }

  async function saveSession(options: {
    navigateToDashboard: boolean;
    silent: boolean;
  }): Promise<boolean> {
    if (!options.silent) {
      setPending(true);
    }
    setError(null);
    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    const body = {
      latitude: lat,
      longitude: lng,
      timezone: timezone.trim(),
      emailEnabled,
      emailAddress: emailEnabled ? emailAddress : null,
      smsEnabled: false,
      phoneNumber: null,
      browserNotificationsEnabled,
      persistentReminders,
      persistenceCadenceMinutes: Number.parseInt(persistenceCadenceMinutes, 10),
      followupEnabled,
      followupDelayMinutes: Number.parseInt(followupDelayMinutes, 10),
      prayerMethod,
    };

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save. Try again.");
        return false;
      }
      if (options.navigateToDashboard) {
        router.push(`/s/${sessionId}/dashboard`);
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      if (!options.silent) {
        setPending(false);
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveSession({ navigateToDashboard: true, silent: false });
  }

  async function onDeleteSession() {
    setDeleteError(null);
    setDeletePending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 404) {
        setDeleteError(
          "This session no longer exists. It may already have been deleted.",
        );
        return;
      }
      if (!res.ok) {
        setDeleteError(data.error ?? "Could not delete. Try again.");
        return;
      }
      window.alert(
        "Your data has been deleted. You can set up a new session from the home page anytime.",
      );
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Network error. Check your connection.");
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-6 px-6 py-10">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {headingTitle}
        </h1>
        <p className="text-muted-foreground">{headingDescription}</p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <PrayerTimesPreview
        latitude={latitude}
        longitude={longitude}
        timezone={timezone}
        prayerMethod={prayerMethod}
      />

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Latitude, longitude, and timezone are all required for accurate
            prayer times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-sky-50 via-background to-cyan-50/60 p-4 shadow-sm">
            <p className="mb-3 text-sm font-medium text-foreground">
              Fastest setup: use your device location
            </p>
            <Button
              type="button"
              variant="default"
              size="lg"
              className="h-12 w-full gap-2 rounded-xl px-6 text-base shadow-md transition-shadow hover:shadow-lg sm:max-w-md"
              disabled={locPending}
              onClick={useMyLocation}
            >
              <MapPin className="size-5 shrink-0" aria-hidden />
              {locPending ? "Locating…" : "Use my location"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              We&apos;ll fill latitude, longitude, and timezone when your
              browser allows location access.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                name="latitude"
                type="number"
                inputMode="decimal"
                required
                min={-90}
                max={90}
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                onKeyDown={blockNonNumericCoordKeys}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="40.7128"
                aria-required
              />
              <p className="text-xs text-muted-foreground">
                −90 to 90 (numbers only)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                name="longitude"
                type="number"
                inputMode="decimal"
                required
                min={-180}
                max={180}
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                onKeyDown={blockNonNumericCoordKeys}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="-74.0060"
                aria-required
              />
              <p className="text-xs text-muted-foreground">
                −180 to 180 (numbers only)
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={useCustomTimezone ? "timezone-custom" : "timezone"}>
              Timezone
            </Label>
            {useCustomTimezone ? (
              <>
                <Input
                  id="timezone-custom"
                  name="timezone"
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. America/Detroit or Europe/Oslo"
                  autoComplete="off"
                  spellCheck={false}
                  aria-required
                />
                <p className="text-xs text-muted-foreground">
                  Enter a valid{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    IANA time zone
                  </a>{" "}
                  (Region/City).
                </p>
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    setUseCustomTimezone(false);
                    if (timezone && !isCuratedTimezone(timezone)) {
                      setTimezone("");
                    }
                  }}
                >
                  Choose from common timezones instead
                </button>
              </>
            ) : (
              <>
                <select
                  id="timezone"
                  name="timezone"
                  required
                  value={
                    timezone && isCuratedTimezone(timezone) ? timezone : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") {
                      setUseCustomTimezone(true);
                      setTimezone("");
                      return;
                    }
                    setTimezone(v);
                  }}
                  className={cn(selectFieldClass)}
                  aria-required
                >
                  <option value="" disabled>
                    Select a timezone…
                  </option>
                  {curatedTimeZoneGroups.map(({ region, zones }) => (
                    <optgroup key={region} label={region}>
                      {zones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">Other — enter IANA zone…</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Short list of common zones. Need something else? Use other
                  below.
                </p>
              </>
            )}
          </div>

          <div className="space-y-4 border-t border-border/50 pt-4">
            <div className="space-y-1.5">
              <p className="text-base font-semibold leading-none tracking-tight text-foreground">
                Prayer calculation
              </p>
              <p className="text-sm text-muted-foreground">
                Local calculation with adhan — the preview at the top updates
                when you change location or method.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prayerMethod">Method</Label>
              <select
                id="prayerMethod"
                name="prayerMethod"
                value={prayerMethod}
                onChange={(e) => setPrayerMethod(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              >
                {PRAYER_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose at least one channel. Reminders follow your choices after you
            save. With browser notifications on, use the button below to allow
            permission and subscribe this device (same as on Today).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            <span className="text-sm text-foreground">Email</span>
          </label>
          {emailEnabled ? (
            <div className="space-y-2 pl-7">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input"
              checked={browserNotificationsEnabled}
              onChange={(e) =>
                setBrowserNotificationsEnabled(e.target.checked)
              }
            />
            <span className="text-sm text-foreground">Browser notifications (Web Push)</span>
          </label>
          {browserNotificationsEnabled && pushSubscriptionCount === 0 ? (
            <div className="pl-7">
              <BrowserPushHint
                sessionId={sessionId}
                prepareSession={() =>
                  saveSession({ navigateToDashboard: false, silent: true })
                }
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persistence & follow-up</CardTitle>
          <CardDescription>
            Defaults match the plan: gentle nudges without completion
            tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input"
              checked={persistentReminders}
              onChange={(e) => setPersistentReminders(e.target.checked)}
            />
            <span className="text-sm text-foreground">
              Repeat reminders if I don&apos;t acknowledge (persistence)
            </span>
          </label>
          {persistentReminders ? (
            <div className="space-y-2 pl-7">
              <Label htmlFor="cadence">Repeat every</Label>
              <select
                id="cadence"
                value={persistenceCadenceMinutes}
                onChange={(e) => setPersistenceCadenceMinutes(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              >
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-input"
              checked={followupEnabled}
              onChange={(e) => setFollowupEnabled(e.target.checked)}
            />
            <span className="text-sm text-foreground">
              One follow-up after the first reminder
            </span>
          </label>
          {followupEnabled ? (
            <div className="space-y-2 pl-7">
              <Label htmlFor="followup">Follow-up after</Label>
              <select
                id="followup"
                value={followupDelayMinutes}
                onChange={(e) => setFollowupDelayMinutes(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showDeleteDataSection ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Delete my data</CardTitle>
            <CardDescription>
              Permanently remove this session: reminders, saved location, and
              this link stop working. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
              <Input
                id="delete-confirm"
                name="deleteConfirm"
                type="text"
                autoComplete="off"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="h-11 rounded-lg font-mono"
                aria-label="Type DELETE to confirm account deletion"
              />
            </div>
            {deleteError ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {deleteError}
              </div>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              className="h-11 w-full rounded-xl text-base"
              disabled={
                deletePending || deleteConfirm.trim().toUpperCase() !== "DELETE"
              }
              onClick={onDeleteSession}
            >
              {deletePending ? "Deleting…" : "Delete all my data"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl text-base"
      >
        {pending ? "Saving…" : "Save and continue"}
      </Button>
    </form>
  );
}
