-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'expired');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "browser_notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_address" VARCHAR(320),
ADD COLUMN     "email_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expires_at" TIMESTAMPTZ,
ADD COLUMN     "expiry_day_reminder_sent_at" TIMESTAMPTZ,
ADD COLUMN     "expiry_warning_sent_at" TIMESTAMPTZ,
ADD COLUMN     "followup_delay_minutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "followup_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "persistence_cadence_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "persistent_reminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone_number" VARCHAR(32),
ADD COLUMN     "prayer_method" VARCHAR(64) NOT NULL DEFAULT 'MuslimWorldLeague',
ADD COLUMN     "session_status" "SessionStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" VARCHAR(128);
