import { prisma } from "@/lib/db";
import Link from "next/link";
import NotificationPanel from "@/components/NotificationPanel";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import TodayDeliveriesTable from "./TodayDeliveriesTable";

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

  const [todayOrders, stats, drivers] = await Promise.all([
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
    prisma.user.findMany({
      where: { role: "DRIVER", isActive: true, storeId: store.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">Today&apos;s Total</p>
          <p className="text-2xl font-bold">{totalToday}</p>
        </div>
        {["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED", "CANCELLED"].map(
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
        <div className="lg:col-span-2">
          <TodayDeliveriesTable
            orders={todayOrders.map((o) => ({
              id: o.id,
              patientName: o.patientName,
              deliveryAddress: o.deliveryAddress,
              deliveryCity: o.deliveryCity,
              assignedDriverId: o.assignedDriverId,
              assignedDriverName: o.assignedDriver?.name ?? null,
              status: o.status,
              failedReason: o.failedReason,
              priceAtCreation: o.priceAtCreation,
            }))}
            drivers={drivers}
          />
        </div>

        <div className="lg:col-span-1">
          <NotificationPanel storeSlug={store.slug} />
        </div>
      </div>
    </div>
  );
}
