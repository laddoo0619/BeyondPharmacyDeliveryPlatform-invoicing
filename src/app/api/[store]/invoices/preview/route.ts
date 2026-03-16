import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Start and end dates required" }, { status: 400 });
  }

  // Include both DELIVERED and FAILED orders (attempted delivery is still billed)
  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      status: { in: ["DELIVERED", "FAILED"] },
      scheduledDate: {
        gte: new Date(start),
        lte: new Date(end + "T23:59:59.999Z"),
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const total = orders.reduce((sum, o) => sum + o.priceAtCreation, 0);

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      patientName: o.patientName,
      address: `${o.deliveryAddress}, ${o.deliveryCity}`,
      zone: o.deliveryZoneName,
      price: o.priceAtCreation,
      date: new Date(o.scheduledDate).toLocaleDateString(),
      status: o.status,
    })),
    total,
  });
}
