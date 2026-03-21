-- CreateIndex
CREATE INDEX "Order_storeId_scheduledDate_idx" ON "Order"("storeId", "scheduledDate");
CREATE INDEX "Order_storeId_status_idx" ON "Order"("storeId", "status");
CREATE INDEX "Order_assignedDriverId_storeId_scheduledDate_idx" ON "Order"("assignedDriverId", "storeId", "scheduledDate");
CREATE INDEX "Order_recurringOrderId_scheduledDate_idx" ON "Order"("recurringOrderId", "scheduledDate");
CREATE INDEX "Order_isInvoiced_completedAt_idx" ON "Order"("isInvoiced", "completedAt");
CREATE INDEX "RecurringOrder_isActive_isOnHold_idx" ON "RecurringOrder"("isActive", "isOnHold");
