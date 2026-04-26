import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import EarningsExport from "./EarningsExport";
import { card, emptyState, pageTitle } from "@/lib/portalStyles";

export default async function EarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;
  const range = sp.range === "month" ? "month" : "week";

  // Calculate date range
  const now = new Date();
  const rangeStart = new Date(now);
  if (range === "week") {
    rangeStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
  } else {
    rangeStart.setDate(1); // Start of month
  }
  rangeStart.setHours(0, 0, 0, 0);

  const earningsWhere = {
    assignedDriverId: session.user.id,
    storeId: store.id,
    status: "DELIVERED" as const,
    scheduledDate: { gte: rangeStart },
  };

  // Use aggregate for totals (efficient DB-level sum) + paginated list
  const [stats, deliveries] = await Promise.all([
    prisma.order.aggregate({
      where: earningsWhere,
      _sum: { priceAtCreation: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: earningsWhere,
      select: {
        id: true,
        patientName: true,
        deliveryZoneName: true,
        priceAtCreation: true,
        scheduledDate: true,
      },
      orderBy: { scheduledDate: "desc" },
      take: 100,
    }),
  ]);

  const totalEarnings = stats._sum.priceAtCreation ?? 0;
  const totalCount = stats._count;

  const startStr = rangeStart.toISOString().split("T")[0];
  const endStr = now.toISOString().split("T")[0];

  return (
    <div>
      <h1 className={`${pageTitle} mb-4`}>
        My Earnings, <span className="italic font-semibold">tracked</span>
      </h1>

      {/* Range Toggle */}
      <div className="flex space-x-2 mb-4">
        <Link
          href={`/${storeSlug}/earnings?range=week`}
          className={`px-4 py-3 rounded-full text-sm font-medium ${
            range === "week"
              ? "bg-[#6f8f72]/15 text-[#1e3a8a]"
              : "bg-white/80 text-slate-500 hover:bg-white"
          }`}
        >
          This Week
        </Link>
        <Link
          href={`/${storeSlug}/earnings?range=month`}
          className={`px-4 py-3 rounded-full text-sm font-medium ${
            range === "month"
              ? "bg-[#6f8f72]/15 text-[#1e3a8a]"
              : "bg-white/80 text-slate-500 hover:bg-white"
          }`}
        >
          This Month
        </Link>
      </div>

      {/* Summary Card */}
      <div className={`${card} p-5 mb-4`}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">Completed Deliveries</p>
            <p className="text-2xl font-bold text-[#1e3a8a]">
              {totalCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Earnings</p>
            <p className="text-2xl font-bold text-[#6f8f72]">
              ${totalEarnings.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <EarningsExport
        storeSlug={storeSlug}
        start={startStr}
        end={endStr}
      />

      {/* Deliveries List */}
      {deliveries.length === 0 ? (
        <div className={`${emptyState} mt-4`}>
          No completed deliveries in this <span className="italic text-[#1e3a8a]">period</span>.
        </div>
      ) : (
        <div className="space-y-2 mt-4">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className={`${card} p-3 flex justify-between items-center`}
            >
              <div>
                <p className="text-sm font-semibold text-[#1e3a8a]">
                  {d.patientName}
                </p>
                <p className="text-xs text-slate-500">
                  {d.deliveryZoneName} &middot;{" "}
                  {new Date(d.scheduledDate).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#6f8f72]">
                ${d.priceAtCreation.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
