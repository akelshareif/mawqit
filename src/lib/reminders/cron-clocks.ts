/**
 * Slice 10 — dual clocks for cron: wall-clock eligibility vs virtual time for prayer due checks.
 */
export type CronReminderClocks = {
  realNow: Date;
  reminderNow: Date;
};
