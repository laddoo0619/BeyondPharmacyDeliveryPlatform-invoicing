-- Fridge (refrigerated medication) tracking.
--
-- The flag lives on the recurring profile so it is set once per client and is
-- inherited by every delivery that profile generates. It also lives on BOTH
-- delivery tables: an Anchor/Spoke delivery never creates an "Order" row, so
-- without the ExternalDispatch columns every Anchor fridge client would be
-- invisible to the daily reminder.

ALTER TABLE "RecurringOrder"
ADD COLUMN "hasFridgeItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fridgeItemNote" TEXT;

ALTER TABLE "Order"
ADD COLUMN "hasFridgeItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fridgeItemNote" TEXT,
ADD COLUMN "fridgeCheckedAt" TIMESTAMP(3),
ADD COLUMN "fridgeCheckedById" TEXT;

ALTER TABLE "ExternalDispatch"
ADD COLUMN "hasFridgeItem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fridgeItemNote" TEXT,
ADD COLUMN "fridgeCheckedAt" TIMESTAMP(3),
ADD COLUMN "fridgeCheckedById" TEXT;

-- Serves the daily fridge lookup (store + scheduled day) and the same-day
-- duplicate guard, which scans external dispatches over the same range.
-- CreateIndex
CREATE INDEX "ExternalDispatch_storeId_scheduledDate_idx" ON "ExternalDispatch"("storeId", "scheduledDate");
