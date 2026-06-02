-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
