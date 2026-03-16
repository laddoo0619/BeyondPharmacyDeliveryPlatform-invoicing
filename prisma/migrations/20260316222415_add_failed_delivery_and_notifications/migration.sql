-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "deliveryPostalCode" TEXT NOT NULL,
    "deliveryZoneId" TEXT NOT NULL,
    "deliveryZoneName" TEXT NOT NULL,
    "priceAtCreation" REAL NOT NULL,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "failedReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "scheduledDate" DATETIME NOT NULL,
    "recurringOrderId" TEXT,
    "assignedDriverId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_recurringOrderId_fkey" FOREIGN KEY ("recurringOrderId") REFERENCES "RecurringOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("assignedDriverId", "createdAt", "createdById", "deliveryAddress", "deliveryCity", "deliveryPostalCode", "deliveryZoneId", "deliveryZoneName", "id", "instructions", "patientName", "patientPhone", "priceAtCreation", "recurringOrderId", "scheduledDate", "status", "updatedAt") SELECT "assignedDriverId", "createdAt", "createdById", "deliveryAddress", "deliveryCity", "deliveryPostalCode", "deliveryZoneId", "deliveryZoneName", "id", "instructions", "patientName", "patientPhone", "priceAtCreation", "recurringOrderId", "scheduledDate", "status", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
