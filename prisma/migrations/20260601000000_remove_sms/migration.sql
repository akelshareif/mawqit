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

