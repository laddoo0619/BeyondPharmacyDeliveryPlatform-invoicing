-- Add index to speed up the notifications list query (filter by storeId, order by createdAt desc)
-- CreateIndex
CREATE INDEX "Notification_storeId_createdAt_idx" ON "Notification"("storeId", "createdAt");

-- Add foreign-key indexes for InvoiceLineItem (Postgres does not auto-index FKs).
-- Speeds up reading line items by invoice and the cascade deletes during order purge/deletion.
-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_orderId_idx" ON "InvoiceLineItem"("orderId");
