import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import OrdersPoller from "./OrdersPoller";
import OrdersList from "./OrdersList";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-teal-100 text-teal-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ status?: string; page?: string; search?: string; limit?: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const sp = await searchParams;
  const status = sp.status;
  const search = sp.search?.trim() || "";
  const limit = parseInt(sp.limit || "100");

  // Hide cancelled orders older than 24 hours (they're past the cooldown window)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = {
    storeId: store.id,
    ...(status ? { status } : {}),
    ...(search ? { patientName: { contains: search, mode: "insensitive" as const } } : {}),
    // Exclude cancelled orders whose cancelledAt is older than 24h
    NOT: {
      status: "CANCELLED",
      cancelledAt: { lt: twentyFourHoursAgo },
    },
  };

  const [orders, total, drivers] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { assignedDriver: true, deliveryZone: true },
      orderBy: { scheduledDate: "desc" },
      take: limit,
    }),
    prisma.order.count({ where }),
    prisma.user.findMany({ where: { role: "DRIVER", isActive: true, storeId: store.id } }),
  ]);

  // Group orders by scheduled date
  const grouped: Record<string, typeof orders> = {};
  for (const order of orders) {
    const dateKey = new Date(order.scheduledDate).toISOString().split("T")[0];
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(order);
  }
  const sortedDateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Serialize orders for client component
  const serializedGroups: Record<string, Array<{
    id: string;
    patientName: string;
    deliveryAddress: string;
    deliveryCity: string;
    scheduledDate: string;
    deliveryZoneName: string;
    priceAtCreation: number;
    status: string;
    assignedDriverId: string | null;
    assignedDriverName: string | null;
    cancelledAt: string | null;
  }>> = {};

  for (const [dateKey, dateOrders] of Object.entries(grouped)) {
    serializedGroups[dateKey] = dateOrders.map((order) => ({
      id: order.id,
      patientName: order.patientName,
      deliveryAddress: order.deliveryAddress,
      deliveryCity: order.deliveryCity,
      scheduledDate: order.scheduledDate.toISOString(),
      deliveryZoneName: order.deliveryZoneName,
      priceAtCreation: order.priceAtCreation,
      status: order.status,
      assignedDriverId: order.assignedDriverId,
      assignedDriverName: order.assignedDriver?.name || null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
    }));
  }

  return (
    <div>
      <OrdersPoller />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <Link
          href={`/${storeSlug}/orders/new`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + New Order
        </Link>
      </div>

      {/* Search Bar */}
      <form method="GET" className="mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            name="search"
            placeholder="Search by patient name..."
            defaultValue={search}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </form>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={`/${storeSlug}/orders${search ? `?search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            !status ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({total})
        </Link>
        {["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED", "CANCELLED"].map(
          (s) => (
            <Link
              key={s}
              href={`/${storeSlug}/orders?status=${s}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                status === s
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.replace("_", " ")}
            </Link>
          )
        )}
      </div>

      {/* Grouped Orders */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border px-6 py-12 text-center text-gray-500">
          {search ? `No orders found for "${search}".` : "No orders found."}
        </div>
      ) : (
        <OrdersList
          groupedOrders={serializedGroups}
          sortedDateKeys={sortedDateKeys}
          storeSlug={storeSlug}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          statusColors={statusColors}
        />
      )}

      {/* Load More */}
      {limit < total && (
        <div className="mt-4 text-center">
          <Link
            href={`/${storeSlug}/orders?limit=${limit + 100}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className="inline-block px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            Load More ({total - limit} remaining)
          </Link>
        </div>
      )}
    </div>
  );
}
