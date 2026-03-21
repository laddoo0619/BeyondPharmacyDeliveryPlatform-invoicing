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
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify recurring order belongs to store
  const existing = await prisma.recurringOrder.findUnique({ where: { id, storeId: store.id } });
  if (!existing) {
    return NextResponse.json({ error: "Recurring order not found" }, { status: 404 });
  }

  const body = await req.json();

  const updateData: Record<string, unknown> = {};

  // Toggle active/inactive
  if (typeof body.isActive === "boolean") {
    updateData.isActive = body.isActive;
  }

  // Custom delivery days
  if (body.activeDays) {
    if (
      !Array.isArray(body.activeDays) ||
      body.activeDays.length === 0 ||
      body.activeDays.some(
        (d: unknown) => typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6
      )
    ) {
      return NextResponse.json(
        { error: "activeDays must be a non-empty array of day numbers (0-6)" },
        { status: 400 }
      );
    }
    updateData.activeDays = JSON.stringify(body.activeDays);
  }

  // Vacation hold
  if (typeof body.isOnHold === "boolean") {
    updateData.isOnHold = body.isOnHold;
    if (body.isOnHold) {
      if (!body.holdStart || !body.holdEnd) {
        return NextResponse.json(
          { error: "holdStart and holdEnd are required when enabling hold" },
          { status: 400 }
        );
      }
      const start = new Date(body.holdStart);
      const end = new Date(body.holdEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: "holdStart and holdEnd must be valid dates" },
          { status: 400 }
        );
      }
      if (end <= start) {
        return NextResponse.json(
          { error: "holdEnd must be after holdStart" },
          { status: 400 }
        );
      }
      updateData.holdStart = start;
      updateData.holdEnd = end;
    } else {
      updateData.holdStart = null;
      updateData.holdEnd = null;
    }
  }

  // Driver assignment (null to unassign, string to assign)
  if ("assignedDriverId" in body) {
    updateData.assignedDriverId = body.assignedDriverId || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const updated = await prisma.recurringOrder.update({
    where: { id, storeId: store.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
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

  const existing = await prisma.recurringOrder.findUnique({ where: { id, storeId: store.id } });
  if (!existing) {
    return NextResponse.json({ error: "Recurring order not found" }, { status: 404 });
  }

  await prisma.$transaction([
    // Delete all skip records (required FK)
    prisma.recurringOrderSkip.deleteMany({ where: { recurringOrderId: id } }),
    // Unlink existing orders (preserve delivery history)
    prisma.order.updateMany({ where: { recurringOrderId: id }, data: { recurringOrderId: null } }),
    // Delete the recurring order
    prisma.recurringOrder.delete({ where: { id } }),
  ]);

  return NextResponse.json({ message: "Recurring order deleted" });
}
