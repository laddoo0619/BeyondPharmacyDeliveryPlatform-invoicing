import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function POST(
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

  const { periodStart, periodEnd } = await req.json();

  // Include both DELIVERED and FAILED orders that haven't been invoiced yet
  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      status: { in: ["DELIVERED", "FAILED"] },
      isInvoiced: false,
      scheduledDate: {
        gte: new Date(periodStart),
        lte: new Date(periodEnd + "T23:59:59.999Z"),
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { error: "No delivered/attempted orders found in this period" },
      { status: 400 }
    );
  }

  const totalAmount = orders.reduce((sum, o) => sum + o.priceAtCreation, 0);

  // Generate invoice number
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const count = await prisma.invoice.count({
    where: {
      invoiceNumber: { startsWith: `INV-${year}-${month}` },
      storeId: store.id,
    },
  });
  const invoiceNumber = `INV-${year}-${month}-${String(count + 1).padStart(3, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalAmount,
      generatedById: session.user.id,
      storeId: store.id,
      lineItems: {
        create: orders.map((order) => ({
          orderId: order.id,
          description: `${order.status === "FAILED" ? "Attempted delivery" : "Delivery"} to ${order.deliveryAddress}, ${order.deliveryCity} (${order.deliveryZoneName})`,
          amount: order.priceAtCreation,
        })),
      },
    },
    include: { lineItems: true },
  });

  // Mark all included orders as invoiced to prevent double-billing
  await prisma.order.updateMany({
    where: { id: { in: orders.map((o) => o.id) } },
    data: { isInvoiced: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
