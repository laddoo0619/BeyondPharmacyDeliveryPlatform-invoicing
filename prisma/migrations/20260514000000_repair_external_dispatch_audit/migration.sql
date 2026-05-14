-- Repair a partially applied Spoke/Circuit audit migration.
-- The original migration is already marked as applied in production, but some
-- deployments may have an older ExternalDispatch table without these fields.

ALTER TABLE "ExternalDispatch"
ADD COLUMN IF NOT EXISTS "workflowStep" TEXT,
ADD COLUMN IF NOT EXISTS "externalPlanId" TEXT,
ADD COLUMN IF NOT EXISTS "spokePlanId" TEXT,
ADD COLUMN IF NOT EXISTS "spokeStopId" TEXT,
ADD COLUMN IF NOT EXISTS "spokeDriverId" TEXT,
ADD COLUMN IF NOT EXISTS "spokeOperationId" TEXT,
ADD COLUMN IF NOT EXISTS "webhookPayload" JSONB,
ADD COLUMN IF NOT EXISTS "lastWebhookEventType" TEXT,
ADD COLUMN IF NOT EXISTS "trackingLink" TEXT,
ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "ExternalDispatch_spokeStopId_key"
ON "ExternalDispatch"("spokeStopId");

CREATE INDEX IF NOT EXISTS "ExternalDispatch_externalPlanId_idx"
ON "ExternalDispatch"("externalPlanId");

CREATE INDEX IF NOT EXISTS "ExternalDispatch_storeId_status_idx"
ON "ExternalDispatch"("storeId", "status");

CREATE INDEX IF NOT EXISTS "ExternalDispatch_selectedProviderUserId_storeId_scheduledDate_idx"
ON "ExternalDispatch"("selectedProviderUserId", "storeId", "scheduledDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExternalDispatch_externalPlanId_fkey'
      AND conrelid = '"ExternalDispatch"'::regclass
  ) THEN
    ALTER TABLE "ExternalDispatch"
    ADD CONSTRAINT "ExternalDispatch_externalPlanId_fkey"
    FOREIGN KEY ("externalPlanId") REFERENCES "ExternalPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
