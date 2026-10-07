import type { ComponentProps } from "react";
import DeliveryPoller from "./DeliveryPoller";
import DateNavigation from "./DateNavigation";
import DeliveryList from "./DeliveryList";
import { pageTitle } from "@/lib/portalStyles";

// Presentational driver deliveries screen; the page supplies the data. Kept
// separate so the dev-only style guide can render it from fixtures.
export default function DeliveriesView({
  storeSlug,
  currentDateStr,
  isToday,
  selectedDateLabel,
  pendingCount,
  completedCount,
  failedCount,
  deliveries,
  eligibleForBatchDeliver,
  poll = true,
}: {
  storeSlug: string;
  currentDateStr: string;
  isToday: boolean;
  selectedDateLabel: string;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  deliveries: ComponentProps<typeof DeliveryList>["deliveries"];
  eligibleForBatchDeliver: number;
  poll?: boolean;
}) {
  return (
    <div>
      {poll && <DeliveryPoller />}
      <DateNavigation storeSlug={storeSlug} currentDate={currentDateStr} />
      <h1 className={`${pageTitle} mb-4`}>
        {isToday
          ? <>Your Deliveries, <span className="italic font-semibold">sorted</span></>
          : `Deliveries for ${selectedDateLabel}`}
      </h1>

      <p className="text-sm text-slate-500 mb-4">
        {pendingCount} pending • {completedCount} completed
        {failedCount > 0 && (
          <span className="text-rose-600"> • {failedCount} need re-attempt</span>
        )}
      </p>

      <DeliveryList
        deliveries={deliveries}
        storeSlug={storeSlug}
        selectedDate={currentDateStr}
        isToday={isToday}
        eligibleForBatchDeliver={eligibleForBatchDeliver}
      />
    </div>
  );
}
