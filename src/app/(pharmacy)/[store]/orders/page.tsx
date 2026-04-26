import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import OrdersPoller from "./OrdersPoller";
import OrdersList from "./OrdersList";
import {
  emptyState,
  input,
  pageTitle,
  primaryButton,
  statusBadgeClasses,
} from "@/lib/portalStyles";

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
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
        <h1 className={pageTitle}>
          Orders, <span className="italic font-semibold">organized</span>
        </h1>
        <Link
          href={`/${storeSlug}/orders/new`}
          className={primaryButton}
        >
          + New Order
        </Link>
      </div>

      {/* Search Bar */}
      <form method="GET" className="mb-4">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            name="search"
            placeholder="Search by patient name..."
            defaultValue={search}
            className={`${input} pl-10`}
          />
        </div>
      </form>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href={`/${storeSlug}/orders${search ? `?search=${encodeURIComponent(search)}` : ""}`}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            !status ? "bg-[#6f8f72]/15 text-[#1e3a8a]" : "bg-white/80 text-slate-500 hover:bg-white hover:text-[#1e3a8a]"
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
                  ? "bg-[#6f8f72]/15 text-[#1e3a8a]"
                  : "bg-white/80 text-slate-500 hover:bg-white hover:text-[#1e3a8a]"
              }`}
            >
              {s.replace("_", " ")}
            </Link>
          )
        )}
      </div>

      {/* Grouped Orders */}
      {orders.length === 0 ? (
        <div className={emptyState}>
          {search ? `No orders found for "${search}".` : <>No orders <span className="italic text-[#1e3a8a]">found</span>.</>}
        </div>
      ) : (
        <OrdersList
          groupedOrders={serializedGroups}
          sortedDateKeys={sortedDateKeys}
          storeSlug={storeSlug}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          statusColors={Object.fromEntries(
            ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED", "CANCELLED"].map((s) => [s, statusBadgeClasses(s)])
          )}
        />
      )}

      {/* Load More */}
      {limit < total && (
        <div className="mt-4 text-center">
          <Link
            href={`/${storeSlug}/orders?limit=${limit + 100}${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
            className="inline-block px-4 py-2 text-sm font-semibold text-[#1e3a8a] border border-[#6f8f72]/40 rounded-xl hover:bg-emerald-50"
          >
            Load More ({total - limit} remaining)
          </Link>
        </div>
      )}
    </div>
  );
}
