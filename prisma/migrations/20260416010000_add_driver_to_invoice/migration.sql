-- AlterTable: Add driverId to Invoice for payroll-by-driver billing
ALTER TABLE "Invoice" ADD COLUMN "driverId" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_storeId_driverId_idx" ON "Invoice"("storeId", "driverId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
