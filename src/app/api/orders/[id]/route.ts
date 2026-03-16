import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};

  if (body.status) updateData.status = body.status;
  if (body.assignedDriverId) updateData.assignedDriverId = body.assignedDriverId;

  // Handle FAILED status — save reason and create notification
  if (body.status === "FAILED") {
    updateData.failedReason = body.failedReason || "No reason provided";

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update order and create notification in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: updateData,
      });

      await tx.notification.create({
        data: {
          orderId: id,
          type: "DELIVERY_FAILED",
          message: `Delivery to ${order.patientName} at ${order.deliveryAddress}, ${order.deliveryCity} failed. Reason: ${body.failedReason || "No reason provided"}`,
        },
      });

      return updatedOrder;
    });

    return NextResponse.json(updated);
  }

  // Handle re-attempt: when going from FAILED back to IN_TRANSIT, increment attempt count
  if (body.status === "IN_TRANSIT") {
    const order = await prisma.order.findUnique({ where: { id } });
    if (order?.status === "FAILED") {
      updateData.attemptCount = (order.attemptCount || 1) + 1;
      updateData.failedReason = null;

      const updated = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id },
          data: updateData,
        });

        await tx.notification.create({
          data: {
            orderId: id,
            type: "DELIVERY_REATTEMPT",
            message: `Re-attempt #${updatedOrder.attemptCount} started for delivery to ${order.patientName} at ${order.deliveryAddress}, ${order.deliveryCity}`,
          },
        });

        return updatedOrder;
      });

      return NextResponse.json(updated);
    }
  }

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(order);
}
