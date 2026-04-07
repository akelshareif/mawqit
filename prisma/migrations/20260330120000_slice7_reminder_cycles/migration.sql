-- CreateTable
CREATE TABLE "reminder_cycles" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "prayer_name" VARCHAR(32) NOT NULL,
    "prayer_date" DATE NOT NULL,
    "device_key" VARCHAR(64) NOT NULL DEFAULT '',
    "ack_received" BOOLEAN NOT NULL DEFAULT false,
    "followup_sent" BOOLEAN NOT NULL DEFAULT false,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "first_sent_at" TIMESTAMPTZ,
    "last_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reminder_cycles_session_id_channel_prayer_name_prayer_date_device_key_key" ON "reminder_cycles"("session_id", "channel", "prayer_name", "prayer_date", "device_key");

-- CreateIndex
CREATE INDEX "reminder_cycles_session_id_idx" ON "reminder_cycles"("session_id");

-- AddForeignKey
ALTER TABLE "reminder_cycles" ADD CONSTRAINT "reminder_cycles_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
