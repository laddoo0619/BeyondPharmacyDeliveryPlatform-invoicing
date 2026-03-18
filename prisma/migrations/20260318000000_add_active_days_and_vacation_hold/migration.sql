-- AlterTable: Add new columns
ALTER TABLE "RecurringOrder" ADD COLUMN "activeDays" TEXT NOT NULL DEFAULT '[1]';
ALTER TABLE "RecurringOrder" ADD COLUMN "isOnHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecurringOrder" ADD COLUMN "holdStart" TIMESTAMP(3);
ALTER TABLE "RecurringOrder" ADD COLUMN "holdEnd" TIMESTAMP(3);

-- Migrate existing dayOfWeek values into activeDays JSON arrays
UPDATE "RecurringOrder" SET "activeDays" = '[' || "dayOfWeek" || ']';

-- Drop the old dayOfWeek column
ALTER TABLE "RecurringOrder" DROP COLUMN "dayOfWeek";
