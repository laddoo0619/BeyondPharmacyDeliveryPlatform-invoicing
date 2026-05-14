-- CreateTable
CREATE TABLE "ExternalPlan" (
    "id" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "spokePlanId" TEXT,
    "spokeDriverId" TEXT NOT NULL,
    "selectedProviderUserId" TEXT,
    "lastOperationId" TEXT,
    "lastRequestPayload" JSONB,
    "lastResponsePayload" JSONB,
    "errorMessage" TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalDispatch" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalReference" TEXT,
    "workflowStep" TEXT,
    "externalPlanId" TEXT,
    "spokePlanId" TEXT,
    "spokeStopId" TEXT,
    "spokeDriverId" TEXT,
    "spokeOperationId" TEXT,
    "selectedProviderUserId" TEXT,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "deliveryPostalCode" TEXT NOT NULL,
    "deliveryAddressId" TEXT,
    "deliveryZoneId" TEXT NOT NULL,
    "deliveryZoneName" TEXT NOT NULL,
    "priceAtCreation" DOUBLE PRECISION NOT NULL,
    "instructions" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "webhookPayload" JSONB,
    "lastWebhookEventType" TEXT,
    "trackingLink" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "storeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPlan_planKey_key" ON "ExternalPlan"("planKey");

-- CreateIndex
CREATE INDEX "ExternalPlan_storeId_provider_scheduledDate_idx" ON "ExternalPlan"("storeId", "provider", "scheduledDate");

-- CreateIndex
CREATE INDEX "ExternalPlan_selectedProviderUserId_storeId_scheduledDate_idx" ON "ExternalPlan"("selectedProviderUserId", "storeId", "scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDispatch_idempotencyKey_key" ON "ExternalDispatch"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDispatch_spokeStopId_key" ON "ExternalDispatch"("spokeStopId");

-- CreateIndex
CREATE INDEX "ExternalDispatch_storeId_status_idx" ON "ExternalDispatch"("storeId", "status");

-- CreateIndex
CREATE INDEX "ExternalDispatch_externalPlanId_idx" ON "ExternalDispatch"("externalPlanId");

-- CreateIndex
CREATE INDEX "ExternalDispatch_selectedProviderUserId_storeId_scheduledDate_idx" ON "ExternalDispatch"("selectedProviderUserId", "storeId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "ExternalPlan" ADD CONSTRAINT "ExternalPlan_selectedProviderUserId_fkey" FOREIGN KEY ("selectedProviderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPlan" ADD CONSTRAINT "ExternalPlan_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDispatch" ADD CONSTRAINT "ExternalDispatch_externalPlanId_fkey" FOREIGN KEY ("externalPlanId") REFERENCES "ExternalPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDispatch" ADD CONSTRAINT "ExternalDispatch_selectedProviderUserId_fkey" FOREIGN KEY ("selectedProviderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDispatch" ADD CONSTRAINT "ExternalDispatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
