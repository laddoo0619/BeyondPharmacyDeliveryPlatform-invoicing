import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "DRIVER") {
    return NextResponse.json({ error: "Only drivers can use batch deliver" }, { status: 403 });
  }

  if (session.user.storeId && session.user.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await prisma.$transaction(async (tx) => {
    const eligible = await tx.order.findMany({
      where: {
        assignedDriverId: session.user.id,
        storeId: store.id,
        scheduledDate: { gte: today, lt: tomorrow },
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"] },
      },
      select: { id: true, patientName: true },
    });

    if (eligible.length === 0) return { updated: 0 };

    const ids = eligible.map((o) => o.id);

    await tx.order.updateMany({
      where: { id: { in: ids } },
      data: { status: "DELIVERED", completedAt: new Date() },
    });

    await tx.notification.create({
      data: {
        orderId: ids[0],
        type: "BATCH_DELIVERED",
        message: `Driver batch-delivered ${ids.length} order(s)`,
        storeId: store.id,
      },
    });

    return { updated: ids.length };
  });

  if (result.updated === 0) {
    return NextResponse.json(
      { error: "No eligible orders to deliver" },
      { status: 400 }
    );
  }

  return NextResponse.json({ updated: result.updated });
}
