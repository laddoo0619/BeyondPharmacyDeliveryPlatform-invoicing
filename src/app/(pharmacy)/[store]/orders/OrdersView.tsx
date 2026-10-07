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

export const ORDER_STATUS_FILTERS = [
  "PENDING",
  "ASSIGNED",
  "SUBMITTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "DELIVERY_FAILED",
  "CANCELLED",
];

export type SerializedOrder = {
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
  createdAt: string;
  isExternal: boolean;
  externalProvider: string | null;
  externalDispatchId: string | null;
  canCancelExternal: boolean;
};

// Presentational orders screen; the page supplies the data. Kept separate so
// the dev-only style guide can render it from fixtures.
export default function OrdersView({
  storeSlug,
  status,
  search,
  limit,
  total,
  orderCount,
  groupedOrders,
  sortedDateKeys,
  drivers,
  poll = true,
}: {
  storeSlug: string;
  status: string | undefined;
  search: string;
  limit: number;
  total: number;
  orderCount: number;
  groupedOrders: Record<string, SerializedOrder[]>;
  sortedDateKeys: string[];
  drivers: { id: string; name: string }[];
  poll?: boolean;
}) {
  return (
    <div>
      {poll && <OrdersPoller />}
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
        {ORDER_STATUS_FILTERS.map(
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
              {s.replace(/_/g, " ")}
            </Link>
          )
        )}
      </div>

      {/* Grouped Orders */}
      {orderCount === 0 ? (
        <div className={emptyState}>
          {search ? `No orders found for "${search}".` : <>No orders <span className="italic text-[#1e3a8a]">found</span>.</>}
        </div>
      ) : (
        <OrdersList
          groupedOrders={groupedOrders}
          sortedDateKeys={sortedDateKeys}
          storeSlug={storeSlug}
          drivers={drivers}
          statusColors={Object.fromEntries(
            ORDER_STATUS_FILTERS.map((s) => [s, statusBadgeClasses(s)])
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
