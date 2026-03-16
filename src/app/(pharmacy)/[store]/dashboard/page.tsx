import { prisma } from "@/lib/db";
import Link from "next/link";
import NotificationPanel from "@/components/NotificationPanel";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

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

  const [todayOrders, stats] = await Promise.all([
    prisma.order.findMany({
      where: {
        storeId: store.id,
        scheduledDate: { gte: today, lt: tomorrow },
      },
      include: { assignedDriver: true, deliveryZone: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        storeId: store.id,
        scheduledDate: { gte: today, lt: tomorrow },
      },
      _count: true,
    }),
  ]);

  const totalToday = todayOrders.length;
  const statusCounts = Object.fromEntries(
    stats.map((s) => [s.status, s._count])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href={`/${store.slug}/orders/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + New Order
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">Today&apos;s Total</p>
          <p className="text-2xl font-bold">{totalToday}</p>
        </div>
        {["PENDING", "ASSIGNED", "IN_TRANSIT", "DELIVERED", "FAILED", "CANCELLED"].map(
          (status) => (
            <div
              key={status}
              className={`bg-white p-4 rounded-lg shadow-sm border ${
                status === "FAILED" && (statusCounts[status] || 0) > 0
                  ? "border-red-300"
                  : ""
              }`}
            >
              <p className="text-sm text-gray-500">
                {status.replace("_", " ")}
              </p>
              <p
                className={`text-2xl font-bold ${
                  status === "FAILED" && (statusCounts[status] || 0) > 0
                    ? "text-red-600"
                    : ""
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
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Today&apos;s Deliveries</h2>
          </div>
          {todayOrders.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No deliveries scheduled for today.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {todayOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`hover:bg-gray-50 ${
                        order.status === "FAILED" ? "bg-red-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {order.patientName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {order.deliveryAddress}, {order.deliveryCity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {order.assignedDriver?.name || "Unassigned"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            statusColors[order.status] || "bg-gray-100"
                          }`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                        {order.status === "FAILED" && order.failedReason && (
                          <p className="text-xs text-red-600 mt-1">
                            {order.failedReason}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
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
