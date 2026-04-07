/** Stable `message_type` / message_log.type values. */
export const MESSAGE_TYPE = {
  prayerReminder: "prayer_reminder",
  persistenceResend: "persistence_resend",
  followup: "followup",
  sessionExpiryWarning: "session_expiry_warning",
  sessionExpiryDay: "session_expiry_day",
  calendarEventEnsured: "calendar_event_ensured",
} as const;

export type MessageTypeValue =
  (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];
