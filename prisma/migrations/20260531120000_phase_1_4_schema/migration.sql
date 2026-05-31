-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('monthly', 'quarterly', 'semiannual', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired');

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "email_address",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "phone_number",
DROP COLUMN "timezone";

-- CreateTable
CREATE TABLE "saved_locations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" VARCHAR(120),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" VARCHAR(128) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "RecipientType" NOT NULL,
    "value" VARCHAR(320) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "tier" "SubscriptionTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "period_end" TIMESTAMPTZ NOT NULL,
    "last_renewed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_locations_session_id_idx" ON "saved_locations"("session_id");

-- CreateIndex
CREATE INDEX "notification_recipients_session_id_idx" ON "notification_recipients"("session_id");

-- CreateIndex
CREATE INDEX "notification_recipients_type_value_idx" ON "notification_recipients"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_session_id_key" ON "subscriptions"("session_id");

-- CreateIndex
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "donations_stripe_session_id_key" ON "donations"("stripe_session_id");

-- AddForeignKey
ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

