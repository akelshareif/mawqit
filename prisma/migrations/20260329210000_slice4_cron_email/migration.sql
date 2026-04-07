-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('email', 'sms', 'calendar', 'browser');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('sent', 'failed');

-- CreateEnum
CREATE TYPE "CronRunStatus" AS ENUM ('running', 'success', 'error');

-- CreateTable
CREATE TABLE "channel_status" (
    "session_id" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "disabled_at" TIMESTAMPTZ,

    CONSTRAINT "channel_status_pkey" PRIMARY KEY ("session_id","channel")
);

-- CreateTable
CREATE TABLE "message_log" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "prayer_name" VARCHAR(32),
    "type" VARCHAR(64) NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "to" VARCHAR(320) NOT NULL,
    "body" TEXT,
    "status" "MessageDeliveryStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sent_reminders" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "prayer_name" VARCHAR(32) NOT NULL,
    "prayer_date" DATE NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "message_type" VARCHAR(64) NOT NULL,
    "push_subscription_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "status" "CronRunStatus" NOT NULL,
    "sessions_processed" INTEGER NOT NULL DEFAULT 0,
    "messages_sent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_log_session_id_idx" ON "message_log"("session_id");

-- CreateIndex
CREATE INDEX "sent_reminders_session_id_idx" ON "sent_reminders"("session_id");

-- AddForeignKey
ALTER TABLE "channel_status" ADD CONSTRAINT "channel_status_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_push_subscription_id_fkey" FOREIGN KEY ("push_subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes (mawqit_plan.md — idempotency)
CREATE UNIQUE INDEX "sent_reminders_nonpush_channels_unique"
ON "sent_reminders" ("session_id", "prayer_name", "prayer_date", "channel", "message_type")
WHERE "channel" IN ('email', 'sms', 'calendar') AND "push_subscription_id" IS NULL;

CREATE UNIQUE INDEX "sent_reminders_browser_push_unique"
ON "sent_reminders" ("session_id", "prayer_name", "prayer_date", "message_type", "push_subscription_id")
WHERE "channel" = 'browser' AND "push_subscription_id" IS NOT NULL;
