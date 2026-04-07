export function getSessionValidityDays(): number {
  const raw = process.env.SESSION_VALIDITY_DAYS;
  if (!raw) return 30;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return n;
}

/** Days before `expires_at` to send the “renew soon” notice. Default 3. */
export function getSessionExpiryWarningDays(): number {
  const raw = process.env.SESSION_EXPIRY_WARNING_DAYS;
  if (!raw) return 3;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 3;
  return n;
}

/** Documented cadence for external schedulers (e.g. cron-job.org). Default 5. */
export function getCronIntervalMinutes(): number {
  const raw = process.env.CRON_INTERVAL_MINUTES;
  if (!raw) return 5;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 5;
  return n;
}

/** `mock` — log to `message_log` only; `real` — send via web-push when VAPID keys are set. */
export function getWebPushMode(): "mock" | "real" {
  const raw = process.env.WEB_PUSH_MODE?.toLowerCase();
  if (raw === "real") return "real";
  return "mock";
}

/** VAPID subject for web-push (mailto: or https:). */
export function getVapidSubject(): string {
  const raw = process.env.VAPID_SUBJECT?.trim();
  if (raw) return raw;
  return "mailto:support@mawqit.local";
}

/** Help / learn-to-pray link for inbound HELP replies. */
export function getLearnToPrayUrl(): string {
  const raw = process.env.LEARN_TO_PRAY_URL?.trim();
  if (raw) return raw;
  return "https://example.com/learn-salah";
}

/**
 * Gate debug-only UI and routes (`/s/.../debug`, simulate inbound, etc.).
 * In production, requires `ALLOW_DEBUG_TOOLS_IN_PRODUCTION=true` as well —
 * keep both unset/false in real deployments (Slice 9).
 */
export function getEnableDebugTools(): boolean {
  const want = process.env.ENABLE_DEBUG_TOOLS?.trim().toLowerCase() === "true";
  if (!want) {
    return false;
  }
  if (process.env.NODE_ENV === "production") {
    return (
      process.env.ALLOW_DEBUG_TOOLS_IN_PRODUCTION?.trim().toLowerCase() ===
      "true"
    );
  }
  return true;
}

/** Slice 10 — signed minutes added to wall time for cron reminder passes only. */
export function getQaReminderClockOffsetMinutes(): number {
  const raw = process.env.QA_REMINDER_CLOCK_OFFSET_MINUTES?.trim();
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * When true, `getReminderNow` may shift time for prayer due checks.
 * Explicit env, or debug tools on (local dev convenience).
 */
export function isQaReminderClockEnabled(): boolean {
  if (
    process.env.ENABLE_QA_REMINDER_CLOCK?.trim().toLowerCase() === "true"
  ) {
    return true;
  }
  return getEnableDebugTools();
}

/**
 * Virtual instant for prayer comparisons and persistence timing. Equals `realNow`
 * when QA clock is off or offset is 0.
 */
export function getReminderNow(realNow: Date): Date {
  if (!isQaReminderClockEnabled()) {
    return realNow;
  }
  const offsetMinutes = getQaReminderClockOffsetMinutes();
  if (offsetMinutes === 0) {
    return realNow;
  }
  return new Date(realNow.getTime() + offsetMinutes * 60_000);
}
