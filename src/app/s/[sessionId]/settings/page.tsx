import { SetupForm, type SetupFormInitial } from "@/components/setup-form";
import { getPrisma } from "@/lib/db";
import { sessionHasSavedLocation } from "@/lib/session-has-location";
import { isSessionIdFormat } from "@/lib/session-id";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ sessionId: string }> };

function toInitial(session: {
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
}): SetupFormInitial {
  return {
    latitude: session.latitude,
    longitude: session.longitude,
    timezone: session.timezone,
    emailEnabled: session.emailEnabled,
    emailAddress: session.emailAddress,
    browserNotificationsEnabled: session.browserNotificationsEnabled,
    persistentReminders: session.persistentReminders,
    persistenceCadenceMinutes: session.persistenceCadenceMinutes,
    followupEnabled: session.followupEnabled,
    followupDelayMinutes: session.followupDelayMinutes,
    prayerMethod: session.prayerMethod,
  };
}

export default async function SettingsPage({ params }: PageProps) {
  const { sessionId } = await params;
  if (!isSessionIdFormat(sessionId)) {
    notFound();
  }

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    notFound();
  }

  const pushSubscriptionCount = await prisma.pushSubscription.count({
    where: { sessionId },
  });

  return (
    <SetupForm
      sessionId={sessionId}
      initial={toInitial(session)}
      headingTitle="Location & Reminders"
      headingDescription="Update your location, calculation method, and notification channels. Saving extends your session."
      showDeleteDataSection={sessionHasSavedLocation(session)}
      pushSubscriptionCount={pushSubscriptionCount}
    />
  );
}
