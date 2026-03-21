import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import EarningsExport from "./EarningsExport";

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
      <h1 className="text-xl font-bold text-gray-900 mb-4">My Earnings</h1>

      {/* Range Toggle */}
      <div className="flex space-x-2 mb-4">
        <Link
          href={`/${storeSlug}/earnings?range=week`}
          className={`px-4 py-3 rounded-full text-sm font-medium ${
            range === "week"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          This Week
        </Link>
        <Link
          href={`/${storeSlug}/earnings?range=month`}
          className={`px-4 py-3 rounded-full text-sm font-medium ${
            range === "month"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          This Month
        </Link>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg p-5 border shadow-sm mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Completed Deliveries</p>
            <p className="text-2xl font-bold text-gray-900">
              {totalCount}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Earnings</p>
            <p className="text-2xl font-bold text-green-600">
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
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border mt-4">
          No completed deliveries in this period.
        </div>
      ) : (
        <div className="space-y-2 mt-4">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-lg p-3 border shadow-sm flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {d.patientName}
                </p>
                <p className="text-xs text-gray-500">
                  {d.deliveryZoneName} &middot;{" "}
                  {new Date(d.scheduledDate).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-semibold text-green-600">
                ${d.priceAtCreation.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
