import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import DeliveryForm from "./DeliveryForm";

export default async function DeliverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id, assignedDriverId: session.user.id },
  });

  if (!order || order.status === "DELIVERED" || order.status === "CANCELLED") {
    notFound();
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        {order.status === "FAILED" ? "Re-attempt: " : "Deliver to "}
        {order.patientName}
      </h1>

      <div className="bg-white rounded-lg p-4 border shadow-sm mb-4">
        <p className="text-sm text-gray-500">Address</p>
        <p className="font-medium">
          {order.deliveryAddress}, {order.deliveryCity},{" "}
          {order.deliveryPostalCode}
        </p>
        {order.instructions && (
          <>
            <p className="text-sm text-gray-500 mt-2">Instructions</p>
            <p className="text-sm text-blue-600">{order.instructions}</p>
          </>
        )}
        {order.status === "FAILED" && order.failedReason && (
          <div className="mt-3 bg-red-50 rounded-lg p-3">
            <p className="text-sm text-gray-500">Previous failure reason</p>
            <p className="text-sm text-red-700 font-medium">{order.failedReason}</p>
          </div>
        )}
      </div>

      <DeliveryForm
        orderId={order.id}
        currentStatus={order.status}
        attemptCount={order.attemptCount}
      />
    </div>
  );
}
