import Link from "next/link";
import ExternalDispatchActions from "@/components/ExternalDispatchActions";
import NotificationPanel from "@/components/NotificationPanel";
import {
  card,
  emptyState,
  pageTitle,
  primaryButton,
  sectionTitle,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";

export type DashboardDelivery = {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  driverName: string | null;
  status: string;
  priceAtCreation: number;
  failedReason: string | null;
  createdAt: Date;
  isExternal: boolean;
  externalDispatchId: string | null;
  canCancelExternal: boolean;
};

// Presentational dashboard; the page supplies the data. Kept separate so the
// dev-only style guide can render it from fixtures.
export default function DashboardView({
  storeSlug,
  deliveries,
}: {
  storeSlug: string;
  deliveries: DashboardDelivery[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className={pageTitle}>
          Pharmacy <span className="italic font-semibold">flow</span>
        </h1>
        <Link
          href={`/${storeSlug}/orders/new`}
          className={primaryButton}
        >
          + New Order
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Orders */}
        <div className={`lg:col-span-2 ${card} overflow-hidden`}>
          <div className="px-6 py-4 border-b">
            <h2 className={sectionTitle}>Today&apos;s Deliveries</h2>
          </div>
          {deliveries.length === 0 ? (
            <div className={emptyState}>
              No deliveries <span className="italic text-[#1e3a8a]">scheduled</span> for today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={tableHeader}>
                  <tr>
                    <th className="px-6 py-3">
                      Patient
                    </th>
                    <th className="px-6 py-3">
                      Address
                    </th>
                    <th className="px-6 py-3">
                      Driver
                    </th>
                    <th className="px-6 py-3">
                      Status
                    </th>
                    <th className="px-6 py-3">
                      Price
                    </th>
                    <th className="px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliveries.map((order) => (
                    <tr
                      key={order.id}
                      className={`${tableRow} ${
                        order.status === "FAILED" ? "bg-rose-50/60" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">
                        {order.patientName}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {order.deliveryAddress}, {order.deliveryCity}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <span>{order.driverName || "Unassigned"}</span>
                        {order.isExternal && (
                          <span className="ml-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                            Spoke
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={statusBadgeClasses(order.status)}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                        {order.status === "FAILED" && order.failedReason && (
                          <p className="text-xs text-rose-600 mt-1">
                            {order.failedReason}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">
                        ${order.priceAtCreation.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {order.isExternal ? (
                          <ExternalDispatchActions
                            dispatchId={order.externalDispatchId}
                            currentStatus={order.status}
                            canCancel={order.canCancelExternal}
                            storeSlug={storeSlug}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-1">
          <NotificationPanel storeSlug={storeSlug} />
        </div>
      </div>
    </div>
  );
}
