import DeliveryForm from "./DeliveryForm";
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
      <h1 className={`${pageTitle} mb-4`}>
        {order.status === "FAILED" ? "Re-attempt: " : "Deliver to "}
        <span className="italic font-semibold">{order.patientName}</span>
      </h1>

      <div className={`${card} p-4 mb-4`}>
        <div className="mb-3">
          <span className={statusBadgeClasses(order.status)}>
            {order.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm text-slate-500">Address</p>
        <p className="font-semibold text-[#1e3a8a]">
          {order.deliveryAddress}, {order.deliveryCity},{" "}
          {order.deliveryPostalCode}
        </p>
        {order.instructions && (
          <>
            <p className="text-sm text-slate-500 mt-2">Instructions</p>
            <p className="text-sm text-[#1e3a8a]">{order.instructions}</p>
          </>
        )}
        {order.status === "FAILED" && order.failedReason && (
          <div className="mt-3 bg-rose-50 rounded-2xl p-3 border border-rose-100">
            <p className="text-sm text-slate-500">Previous failure reason</p>
            <p className="text-sm text-rose-700 font-semibold">{order.failedReason}</p>
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
