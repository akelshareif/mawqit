-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "asr_method" VARCHAR(16) NOT NULL DEFAULT 'standard',
ADD COLUMN     "high_latitude_rule" VARCHAR(32) NOT NULL DEFAULT 'middleofthenight';

