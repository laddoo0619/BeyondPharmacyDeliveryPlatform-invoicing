import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodStart, periodEnd } = await req.json();

  const orders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      scheduledDate: {
        gte: new Date(periodStart),
        lte: new Date(periodEnd + "T23:59:59.999Z"),
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { error: "No delivered orders found in this period" },
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
      lineItems: {
        create: orders.map((order) => ({
          orderId: order.id,
          description: `Delivery to ${order.deliveryAddress}, ${order.deliveryCity} (${order.deliveryZoneName})`,
          amount: order.priceAtCreation,
        })),
      },
    },
    include: { lineItems: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}
