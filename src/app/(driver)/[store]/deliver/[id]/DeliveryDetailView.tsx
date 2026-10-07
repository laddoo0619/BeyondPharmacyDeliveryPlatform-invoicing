import DeliveryForm from "./DeliveryForm";
import PageHeader from "@/components/ui/PageHeader";
import { card, pageTitle, statusBadgeClasses } from "@/lib/portalStyles";

export interface DeliveryDetailOrder {
  id: string;
  status: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  instructions: string | null;
  failedReason: string | null;
  attemptCount: number;
}

// Presentational delivery screen; the page supplies the order. Kept separate
// so the dev-only style guide can render it from fixtures.
export default function DeliveryDetailView({
  storeSlug,
  order,
}: {
  storeSlug: string;
  order: DeliveryDetailOrder;
}) {
  return (
    <div>
      <PageHeader className="mb-4">
        <h1 className={pageTitle}>
          {order.status === "FAILED" ? "Re-attempt: " : "Deliver to "}
          <span className="accent">{order.patientName}</span>
        </h1>
      </PageHeader>

      <div className={`${card} p-4 mb-4`}>
        <div className="mb-3">
          <span className={statusBadgeClasses(order.status)}>
            {order.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-muted">Address</p>
        <p className="font-semibold text-navy">
          {order.deliveryAddress}, {order.deliveryCity},{" "}
          {order.deliveryPostalCode}
        </p>
        {order.instructions && (
          <>
            <p className="text-sm text-muted mt-2">Instructions</p>
            <p className="text-sm text-navy">{order.instructions}</p>
          </>
        )}
        {order.status === "FAILED" && order.failedReason && (
          <div className="mt-3 bg-blush rounded-row p-3">
            <p className="text-sm text-navy">Previous failure reason</p>
            <p className="text-sm text-danger font-semibold">{order.failedReason}</p>
          </div>
        )}
      </div>

      <DeliveryForm
        orderId={order.id}
        currentStatus={order.status}
        attemptCount={order.attemptCount}
        storeSlug={storeSlug}
      />
    </div>
  );
}
