-- Serves the daily release/watchdog/stall/dedup scans over external dispatches
-- (provider + status + scheduledDate), which otherwise degrade linearly as the
-- table grows. Note: spokeStopId (the webhook lookup key) is already backed by
-- a unique index via its @unique constraint.
-- CreateIndex
CREATE INDEX "ExternalDispatch_provider_status_scheduledDate_idx" ON "ExternalDispatch"("provider", "status", "scheduledDate");
