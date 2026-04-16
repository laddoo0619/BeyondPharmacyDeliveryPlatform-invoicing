-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Primary',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_patientId_idx" ON "Address"("patientId");

-- CreateIndex
CREATE INDEX "Address_patientId_isDefault_idx" ON "Address"("patientId", "isDefault");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create a "Primary" Address row for every existing Patient
INSERT INTO "Address" ("id", "patientId", "label", "address", "city", "postalCode", "isDefault", "createdAt", "updatedAt")
SELECT
    'addr_' || md5(random()::text || clock_timestamp()::text || "id"),
    "id",
    'Primary',
    "address",
    "city",
    "postalCode",
    true,
    NOW(),
    NOW()
FROM "Patient";

-- AlterTable: Add idempotencyKey, patientId, and deliveryAddressId to Order
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "patientId" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryAddressId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_storeId_patientId_idx" ON "Order"("storeId", "patientId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
