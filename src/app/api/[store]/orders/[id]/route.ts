import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user belongs to this store
  if (session.user.storeId && session.user.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const updateData: Record<string, unknown> = {};

  if (body.status) updateData.status = body.status;
  if (body.assignedDriverId) updateData.assignedDriverId = body.assignedDriverId;

  // Set cancelledAt timestamp when cancelling an order (Stage 1 of soft delete)
  if (body.status === "CANCELLED") {
    updateData.cancelledAt = new Date();
  }

  // Set completedAt when order reaches a terminal status
  if (body.status === "DELIVERED" || body.status === "FAILED") {
    updateData.completedAt = new Date();
  }

  // Auto-promote PENDING to ASSIGNED when a driver is assigned without explicit status
  if (body.assignedDriverId && !body.status) {
    const current = await prisma.order.findUnique({ where: { id, storeId: store.id } });
    if (!current) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (current.status === "PENDING") {
      updateData.status = "ASSIGNED";
    }
  }

  // Handle PICKED_UP status — create notification for pharmacy
  if (body.status === "PICKED_UP") {
    const order = await prisma.order.findUnique({ where: { id, storeId: store.id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id, storeId: store.id },
        data: updateData,
      });

      await tx.notification.create({
        data: {
          orderId: id,
          type: "ORDER_PICKED_UP",
          message: `Driver picked up delivery for ${order.patientName} at ${order.deliveryAddress}, ${order.deliveryCity}`,
          storeId: store.id,
        },
      });

      return updatedOrder;
    });

    return NextResponse.json(updated);
  }

  // Handle FAILED status — save reason and create notification
  if (body.status === "FAILED") {
    updateData.failedReason = body.failedReason || "No reason provided";

    const order = await prisma.order.findUnique({ where: { id, storeId: store.id } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update order and create notification in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id, storeId: store.id },
        data: updateData,
      });

      await tx.notification.create({
        data: {
          orderId: id,
          type: "DELIVERY_FAILED",
          message: `Delivery to ${order.patientName} at ${order.deliveryAddress}, ${order.deliveryCity} failed. Reason: ${body.failedReason || "No reason provided"}`,
          storeId: store.id,
        },
      });

      return updatedOrder;
    });

    return NextResponse.json(updated);
  }

  // Handle re-attempt: when going from FAILED back to IN_TRANSIT, increment attempt count
  if (body.status === "IN_TRANSIT") {
    const order = await prisma.order.findUnique({ where: { id, storeId: store.id } });
    if (order?.status === "FAILED") {
      updateData.attemptCount = (order.attemptCount || 1) + 1;
      updateData.failedReason = null;
      updateData.completedAt = null;

      const updated = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id, storeId: store.id },
          data: updateData,
        });

        await tx.notification.create({
          data: {
            orderId: id,
            type: "DELIVERY_REATTEMPT",
            message: `Re-attempt #${updatedOrder.attemptCount} started for delivery to ${order.patientName} at ${order.deliveryAddress}, ${order.deliveryCity}`,
            storeId: store.id,
          },
        });

        return updatedOrder;
      });

      return NextResponse.json(updated);
    }
  }

  // Verify order belongs to store before generic update
  const existing = await prisma.order.findUnique({ where: { id, storeId: store.id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const order = await prisma.order.update({
    where: { id, storeId: store.id },
    data: updateData,
  });

  return NextResponse.json(order);
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.storeId && session.user.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id, storeId: store.id },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Guard: completed orders must be invoiced before deletion
  if ((order.status === "DELIVERED" || order.status === "FAILED") && !order.isInvoiced) {
    return NextResponse.json(
      { error: "Cannot delete: this order has not been invoiced yet. Generate an invoice first." },
      { status: 409 }
    );
  }

  // Stage 1: If order is not yet cancelled, soft-delete it
  if (order.status !== "CANCELLED") {
    const updated = await prisma.order.update({
      where: { id, storeId: store.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return NextResponse.json({
      message: "Order cancelled. It can be permanently deleted after 24 hours.",
      order: updated,
    });
  }

  // Stage 2: Order is already cancelled — check cooldown
  if (!order.cancelledAt) {
    // Edge case: cancelled before cancelledAt field existed — set it now
    await prisma.order.update({
      where: { id, storeId: store.id },
      data: { cancelledAt: new Date() },
    });
    return NextResponse.json(
      {
        error: "Cooldown period started. You can permanently delete this order after 24 hours.",
        cancelledAt: new Date().toISOString(),
      },
      { status: 409 }
    );
  }

  const elapsed = Date.now() - new Date(order.cancelledAt).getTime();
  if (elapsed < COOLDOWN_MS) {
    const remainingMs = COOLDOWN_MS - elapsed;
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return NextResponse.json(
      {
        error: `Cannot permanently delete yet. ${remainingHours} hour(s) remaining in the 24-hour cooldown.`,
        cancelledAt: order.cancelledAt,
        canDeleteAfter: new Date(new Date(order.cancelledAt).getTime() + COOLDOWN_MS).toISOString(),
      },
      { status: 409 }
    );
  }

  // Cooldown passed — permanently delete (cascade related records)
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { orderId: id } });
    await tx.invoiceLineItem.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id, storeId: store.id } });
  });

  return NextResponse.json({ message: "Order permanently deleted." });
}
