-- AlterTable
ALTER TABLE "RecurringOrder" ADD COLUMN "assignedDriverId" TEXT;

-- AddForeignKey
ALTER TABLE "RecurringOrder" ADD CONSTRAINT "RecurringOrder_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
