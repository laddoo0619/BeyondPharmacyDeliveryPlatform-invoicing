-- Allow store-level notifications that aren't tied to an in-house Order row
-- (e.g. a failed Spoke dispatch, where no Order is ever created).
-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "orderId" DROP NOT NULL;
