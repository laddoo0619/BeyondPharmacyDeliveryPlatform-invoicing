import Link from "next/link";
import ExternalDispatchActions from "@/components/ExternalDispatchActions";
import NotificationPanel from "@/components/NotificationPanel";
import PageHeader from "@/components/ui/PageHeader";
import {
  card,
  cn,
  ctaShadow,
  emptyState,
  pageAction,
  pageTitle,
  primaryButton,
  sectionTitle,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";
import { toneBadgeClasses } from "@/lib/statusTheme";

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
      <PageHeader className="flex items-center justify-between mb-8">
        <h1 className={pageTitle}>
          Pharmacy flow
        </h1>
        <Link
          href={`/${storeSlug}/orders/new`}
          className={cn(primaryButton, ctaShadow, pageAction)}
        >
          + New Order
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Orders */}
        <div data-reveal="" className={`lg:col-span-2 ${card} overflow-hidden`}>
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className={sectionTitle}>Today&apos;s Deliveries</h2>
          </div>
          {deliveries.length === 0 ? (
            <div className={cn(emptyState, "m-4")}>
              No deliveries <span className="text-navy">scheduled</span> for today.
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
                <tbody className="divide-y divide-hairline">
                  {deliveries.map((order) => (
                    <tr
                      key={order.id}
                      className={`${tableRow} ${
                        order.status === "FAILED" ? "bg-blush" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-navy">
                        {order.patientName}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink">
                        {order.deliveryAddress}, {order.deliveryCity}
                      </td>
                      <td className="px-6 py-4 text-sm text-ink">
                        <span>{order.driverName || "Unassigned"}</span>
                        {order.isExternal && (
                          <span className="ml-2 inline-flex rounded-full bg-blue px-2 py-0.5 text-xs font-bold text-navy">
                            Spoke
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {/* On the blush failed row, the chip turns white to stay visible. */}
                        <span className={order.status === "FAILED" ? toneBadgeClasses("white") : statusBadgeClasses(order.status)}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                        {order.status === "FAILED" && order.failedReason && (
                          <p className="text-xs text-danger mt-1">
                            {order.failedReason}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-navy tabular-nums">
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
                          <span className="text-xs text-ink">-</span>
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
        <div data-reveal="" className="lg:col-span-1">
          <NotificationPanel storeSlug={storeSlug} />
        </div>
      </div>
    </div>
  );
}
