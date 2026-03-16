import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import Link from "next/link";

const statusColors: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
};

export default async function DeliveriesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const deliveries = await prisma.order.findMany({
    where: {
      assignedDriverId: session.user.id,
      scheduledDate: { gte: today, lt: tomorrow },
      status: { in: ["ASSIGNED", "IN_TRANSIT", "DELIVERED"] },
    },
    include: { proofOfDelivery: true },
    orderBy: { createdAt: "asc" },
  });

  const pending = deliveries.filter((d) => d.status !== "DELIVERED");
  const completed = deliveries.filter((d) => d.status === "DELIVERED");

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        Today&apos;s Deliveries
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        {pending.length} pending • {completed.length} completed
      </p>

      {deliveries.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border">
          No deliveries assigned for today.
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="bg-white rounded-lg p-4 border shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {delivery.patientName}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
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
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    statusColors[delivery.status] || "bg-gray-100"
                  }`}
                >
                  {delivery.status.replace("_", " ")}
                </span>
              </div>
              {delivery.status !== "DELIVERED" && (
                <Link
                  href={`/deliver/${delivery.id}`}
                  className="mt-3 block w-full text-center bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  {delivery.status === "ASSIGNED"
                    ? "Start Delivery"
                    : "Complete Delivery"}
                </Link>
              )}
              {delivery.proofOfDelivery && (
                <p className="mt-2 text-xs text-green-600 font-medium">
                  Delivered at{" "}
                  {new Date(delivery.proofOfDelivery.deliveredAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
