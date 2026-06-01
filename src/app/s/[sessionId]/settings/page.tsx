import { SetupForm, type SetupFormInitial } from "@/components/setup-form";
import { getPrisma } from "@/lib/db";
import { sessionHasSavedLocation } from "@/lib/session-has-location";
import { isSessionIdFormat } from "@/lib/session-id";
import { activeLocation, primaryRecipientValue } from "@/lib/session-targets";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ sessionId: string }> };

function toInitial(session: {
  savedLocations: { latitude: number; longitude: number; timezone: string }[];
  recipients: { type: "email"; value: string; isPrimary: boolean }[];
  emailEnabled: boolean;
  browserNotificationsEnabled: boolean;
  persistentReminders: boolean;
  persistenceCadenceMinutes: number;
  followupEnabled: boolean;
  followupDelayMinutes: number;
  prayerMethod: string;
  asrMethod: string;
  highLatitudeRule: string;
}): SetupFormInitial {
  const loc = activeLocation(session.savedLocations);
  return {
    latitude: loc?.latitude ?? null,
    longitude: loc?.longitude ?? null,
    timezone: loc?.timezone ?? null,
    emailEnabled: session.emailEnabled,
    emailAddress: primaryRecipientValue(session.recipients, "email"),
    browserNotificationsEnabled: session.browserNotificationsEnabled,
    persistentReminders: session.persistentReminders,
    persistenceCadenceMinutes: session.persistenceCadenceMinutes,
    followupEnabled: session.followupEnabled,
    followupDelayMinutes: session.followupDelayMinutes,
    prayerMethod: session.prayerMethod,
    asrMethod: session.asrMethod,
    highLatitudeRule: session.highLatitudeRule,
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
    include: {
      savedLocations: { where: { isActive: true }, take: 1 },
      recipients: { where: { isPrimary: true } },
    },
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
