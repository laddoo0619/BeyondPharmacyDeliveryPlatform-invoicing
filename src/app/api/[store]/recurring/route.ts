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

  const body = await req.json();

  const recurringOrder = await prisma.recurringOrder.create({
    data: {
      patientName: body.patientName,
      patientPhone: body.patientPhone || null,
      deliveryAddress: body.deliveryAddress,
      deliveryCity: body.deliveryCity,
      deliveryPostalCode: body.deliveryPostalCode,
      deliveryZoneId: body.deliveryZoneId,
      instructions: body.instructions || null,
      dayOfWeek: body.dayOfWeek ?? 1,
      createdById: session.user.id,
      storeId: store.id,
    },
  });

  return NextResponse.json(recurringOrder, { status: 201 });
}
