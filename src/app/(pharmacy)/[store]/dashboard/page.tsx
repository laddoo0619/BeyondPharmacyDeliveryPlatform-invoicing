import { prisma } from "@/lib/db";
import Link from "next/link";
import NotificationPanel from "@/components/NotificationPanel";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import { recurringPeopleMatch } from "@/lib/recurringDuplicateGuard";
import type { Prisma } from "@prisma/client";
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

type DashboardOrder = Prisma.OrderGetPayload<{
  include: { assignedDriver: true; deliveryZone: true };
}>;

function shouldReplaceDuplicateOrder(
  existing: DashboardOrder,
  candidate: DashboardOrder
) {
  if (existing.status === "CANCELLED" && candidate.status !== "CANCELLED") {
    return true;
  }
  if (existing.status !== "CANCELLED" && candidate.status === "CANCELLED") {
    return false;
  }
  return candidate.createdAt < existing.createdAt;
}

function dedupeRecurringDashboardOrders(orders: DashboardOrder[]) {
  const displayOrders: DashboardOrder[] = [];

  for (const order of orders) {
    if (!order.recurringOrderId) {
      displayOrders.push(order);
      continue;
    }

    const duplicateIndex = displayOrders.findIndex(
      (candidate) =>
        !!candidate.recurringOrderId && recurringPeopleMatch(candidate, order)
    );

    if (duplicateIndex === -1) {
      displayOrders.push(order);
    } else if (shouldReplaceDuplicateOrder(displayOrders[duplicateIndex], order)) {
      displayOrders[duplicateIndex] = order;
    }
  }

  return displayOrders.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rawTodayOrders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      scheduledDate: { gte: today, lt: tomorrow },
    },
    include: { assignedDriver: true, deliveryZone: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const todayOrders = dedupeRecurringDashboardOrders(rawTodayOrders);

  const totalToday = todayOrders.length;
  const statusCounts = todayOrders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className={pageTitle}>
          Pharmacy <span className="italic font-semibold">flow</span>
        </h1>
        <Link
          href={`/${store.slug}/orders/new`}
          className={primaryButton}
        >
          + New Order
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        <div className={`${card} p-4`}>
          <p className="text-sm text-slate-500">Today&apos;s Total</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{totalToday}</p>
        </div>
        {["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED", "CANCELLED"].map(
          (status) => (
            <div
              key={status}
              className={`${card} p-4 ${
                status === "FAILED" && (statusCounts[status] || 0) > 0
                  ? "border-rose-200"
                  : ""
              }`}
            >
              <p className="text-sm text-slate-500">
                {status.replace("_", " ")}
              </p>
              <p
                className={`text-2xl font-bold ${
                  status === "FAILED" && (statusCounts[status] || 0) > 0
                    ? "text-rose-600"
                    : "text-[#1e3a8a]"
                }`}
              >
                {statusCounts[status] || 0}
              </p>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Orders */}
        <div className={`lg:col-span-2 ${card} overflow-hidden`}>
          <div className="px-6 py-4 border-b">
            <h2 className={sectionTitle}>Today&apos;s Deliveries</h2>
          </div>
          {todayOrders.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayOrders.map((order) => (
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
                        {order.assignedDriver?.name || "Unassigned"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={statusBadgeClasses(order.status)}>
                          {order.status.replace("_", " ")}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notifications Panel */}
        <div className="lg:col-span-1">
          <NotificationPanel storeSlug={store.slug} />
        </div>
      </div>
    </div>
  );
}
