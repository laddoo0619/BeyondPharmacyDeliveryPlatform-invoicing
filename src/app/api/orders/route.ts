import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createOrderSchema = z.object({
  patientName: z.string().min(1),
  patientPhone: z.string().optional().default(""),
  deliveryAddress: z.string().min(1),
  deliveryCity: z.string().min(1),
  deliveryPostalCode: z.string().min(1),
  deliveryZoneId: z.string().min(1),
  instructions: z.string().optional().default(""),
  scheduledDate: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Get zone for price snapshot
  const zone = await prisma.deliveryZone.findUnique({
    where: { id: data.deliveryZoneId },
  });

  if (!zone) {
    return NextResponse.json({ error: "Invalid delivery zone" }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      patientName: data.patientName,
      patientPhone: data.patientPhone || null,
      deliveryAddress: data.deliveryAddress,
      deliveryCity: data.deliveryCity,
      deliveryPostalCode: data.deliveryPostalCode,
      deliveryZoneId: data.deliveryZoneId,
      deliveryZoneName: zone.name,
      priceAtCreation: zone.price,
      instructions: data.instructions || null,
      scheduledDate: new Date(data.scheduledDate),
      status: "PENDING",
      createdById: session.user.id,
    },
  });

  return NextResponse.json(order, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    include: { assignedDriver: true, deliveryZone: true },
    orderBy: { scheduledDate: "desc" },
  });

  return NextResponse.json(orders);
}
