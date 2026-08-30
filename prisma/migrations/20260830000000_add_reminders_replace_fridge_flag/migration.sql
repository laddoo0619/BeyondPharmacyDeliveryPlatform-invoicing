-- Replaces the per-profile fridge flag with staff-authored, date-targeted
-- reminders. The flag fired on EVERY delivery day of a recurring profile, but
-- fridge items often arrive monthly against a weekly delivery schedule, so it
-- nagged on days with nothing to pull. Reminders name the day instead.

CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "patientName" TEXT,
    "recurringOrderId" TEXT,
    "remindOn" TIMESTAMP(3) NOT NULL,
    "repeatIntervalWeeks" INTEGER,
    "sourceReminderId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- Serves the daily popup lookup: open reminders due on or before today.
CREATE INDEX "Reminder_storeId_completedAt_remindOn_idx" ON "Reminder"("storeId", "completedAt", "remindOn");
CREATE INDEX "Reminder_sourceReminderId_idx" ON "Reminder"("sourceReminderId");

ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NOTE: the now-unused fridge columns on "RecurringOrder", "Order" and
-- "ExternalDispatch" are deliberately NOT dropped here.
--
-- Migrations run during the build, while the PREVIOUS deployment is still
-- serving traffic. Dropping columns that the live code still selects would
-- make the orders/dashboard/recurring pages error for the length of the build.
-- The columns are empty (verified: 0 flagged rows, 0 acknowledgements) and
-- every one is either nullable or NOT NULL DEFAULT false, so inserts from the
-- new code — which never mentions them — keep working untouched.
--
-- They can be dropped in a follow-up migration once this deploy is live:
--   ALTER TABLE "RecurringOrder" DROP COLUMN "hasFridgeItem", DROP COLUMN "fridgeItemNote";
--   ALTER TABLE "Order" DROP COLUMN "hasFridgeItem", DROP COLUMN "fridgeItemNote",
--     DROP COLUMN "fridgeCheckedAt", DROP COLUMN "fridgeCheckedById";
--   ALTER TABLE "ExternalDispatch" DROP COLUMN "hasFridgeItem", DROP COLUMN "fridgeItemNote",
--     DROP COLUMN "fridgeCheckedAt", DROP COLUMN "fridgeCheckedById";
