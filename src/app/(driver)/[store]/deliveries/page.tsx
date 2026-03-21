import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeliveryPoller from "./DeliveryPoller";
import PickUpButton from "./PickUpButton";

const statusColors: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-teal-100 text-teal-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

export default async function DeliveriesPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const session = await auth();
  if (!session?.user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Fetch today's deliveries + any FAILED orders from previous days (for re-attempt)
  const [todayDeliveries, failedFromPreviousDays] = await Promise.all([
    prisma.order.findMany({
      where: {
        assignedDriverId: session.user.id,
        storeId: store.id,
        scheduledDate: { gte: today, lt: tomorrow },
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"] },
      },
      include: { proofOfDelivery: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: {
        assignedDriverId: session.user.id,
        storeId: store.id,
        scheduledDate: { lt: today },
        status: "FAILED",
      },
      include: { proofOfDelivery: true },
      orderBy: { scheduledDate: "desc" },
    }),
  ]);

  // Combine: failed from previous days first, then today's
  const allDeliveries = [...failedFromPreviousDays, ...todayDeliveries];

  const pending = allDeliveries.filter(
    (d) => d.status !== "DELIVERED"
  );
  const completed = allDeliveries.filter((d) => d.status === "DELIVERED");
  const failed = allDeliveries.filter((d) => d.status === "FAILED");

  return (
    <div>
      <DeliveryPoller />
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        Today&apos;s Deliveries
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        {pending.length} pending • {completed.length} completed
        {failed.length > 0 && (
          <span className="text-red-600"> • {failed.length} need re-attempt</span>
        )}
      </p>

      {allDeliveries.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border">
          No deliveries assigned for today.
        </div>
      ) : (
        <div className="space-y-3">
          {allDeliveries.map((delivery) => {
            const isFromPreviousDay =
              new Date(delivery.scheduledDate) < today;

            return (
              <div
                key={delivery.id}
                className={`bg-white rounded-lg p-4 border shadow-sm ${
                  delivery.status === "FAILED" ? "border-red-300" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {delivery.patientName}
                    </p>
                    <p className="text-sm text-gray-500 mt-1 break-words">
                      {delivery.deliveryAddress}
                    </p>
                    <p className="text-sm text-gray-500">
                      {delivery.deliveryCity}, {delivery.deliveryPostalCode}
                    </p>
                    {delivery.instructions && (
                      <p className="text-sm text-blue-600 mt-1">
                        Note: {delivery.instructions}
                      </p>
                    )}
                    {delivery.status === "FAILED" && delivery.failedReason && (
                      <p className="text-sm text-red-600 mt-1 font-medium">
                        Failed: {delivery.failedReason}
                      </p>
                    )}
                    {isFromPreviousDay && (
                      <p className="text-xs text-orange-600 mt-1">
                        From {new Date(delivery.scheduledDate).toLocaleDateString()}
                      </p>
                    )}
                    {delivery.attemptCount > 1 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Attempt #{delivery.attemptCount}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[delivery.status] || "bg-gray-100"
                    }`}
                  >
                    {delivery.status === "FAILED"
                      ? "FAILED"
                      : delivery.status.replace("_", " ")}
                  </span>
                </div>

                {delivery.status === "FAILED" && (
                  <Link
                    href={`/${store.slug}/deliver/${delivery.id}`}
                    className="mt-3 block w-full text-center bg-orange-500 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-orange-600"
                  >
                    Re-attempt Delivery
                  </Link>
                )}

                {delivery.status === "ASSIGNED" && (
                  <PickUpButton orderId={delivery.id} storeSlug={store.slug} />
                )}

                {(delivery.status === "PICKED_UP" ||
                  delivery.status === "IN_TRANSIT") && (
                  <Link
                    href={`/${store.slug}/deliver/${delivery.id}`}
                    className="mt-3 block w-full text-center bg-green-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    {delivery.status === "PICKED_UP"
                      ? "Start Delivery"
                      : "Complete Delivery"}
                  </Link>
                )}

                {delivery.proofOfDelivery && (
                  <p className="mt-2 text-xs text-green-600 font-medium">
                    Delivered at{" "}
                    {new Date(
                      delivery.proofOfDelivery.deliveredAt
                    ).toLocaleTimeString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
