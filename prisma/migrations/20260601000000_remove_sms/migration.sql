-- The two partial unique indexes on sent_reminders (added as raw SQL in
-- slice4_cron_email) have WHERE predicates that reference ReminderChannel literals.
-- Postgres can't retype the `channel` column while those predicates depend on the
-- old enum, so we drop them first and recreate them (without 'sms') after the swap.
DROP INDEX "sent_reminders_nonpush_channels_unique";
DROP INDEX "sent_reminders_browser_push_unique";

-- AlterEnum
BEGIN;
CREATE TYPE "ReminderChannel_new" AS ENUM ('email', 'calendar', 'browser');
ALTER TABLE "reminder_cycles" ALTER COLUMN "channel" TYPE "ReminderChannel_new" USING ("channel"::text::"ReminderChannel_new");
ALTER TABLE "channel_status" ALTER COLUMN "channel" TYPE "ReminderChannel_new" USING ("channel"::text::"ReminderChannel_new");
ALTER TABLE "message_log" ALTER COLUMN "channel" TYPE "ReminderChannel_new" USING ("channel"::text::"ReminderChannel_new");
ALTER TABLE "sent_reminders" ALTER COLUMN "channel" TYPE "ReminderChannel_new" USING ("channel"::text::"ReminderChannel_new");
ALTER TYPE "ReminderChannel" RENAME TO "ReminderChannel_old";
ALTER TYPE "ReminderChannel_new" RENAME TO "ReminderChannel";
DROP TYPE "ReminderChannel_old";
COMMIT;

-- Recreate the partial unique indexes without the removed 'sms' channel.
CREATE UNIQUE INDEX "sent_reminders_nonpush_channels_unique"
ON "sent_reminders" ("session_id", "prayer_name", "prayer_date", "channel", "message_type")
WHERE "channel" IN ('email', 'calendar') AND "push_subscription_id" IS NULL;

CREATE UNIQUE INDEX "sent_reminders_browser_push_unique"
ON "sent_reminders" ("session_id", "prayer_name", "prayer_date", "message_type", "push_subscription_id")
WHERE "channel" = 'browser' AND "push_subscription_id" IS NOT NULL;

-- AlterEnum
BEGIN;
CREATE TYPE "RecipientType_new" AS ENUM ('email');
ALTER TABLE "notification_recipients" ALTER COLUMN "type" TYPE "RecipientType_new" USING ("type"::text::"RecipientType_new");
ALTER TYPE "RecipientType" RENAME TO "RecipientType_old";
ALTER TYPE "RecipientType_new" RENAME TO "RecipientType";
DROP TYPE "RecipientType_old";
COMMIT;

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "sms_enabled";
