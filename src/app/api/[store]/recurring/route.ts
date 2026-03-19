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

  // Validate activeDays if provided
  const activeDays = body.activeDays ?? [1];
  if (
    !Array.isArray(activeDays) ||
    activeDays.length === 0 ||
    activeDays.some(
      (d: unknown) => typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6
    )
  ) {
    return NextResponse.json(
      { error: "activeDays must be a non-empty array of day numbers (0-6)" },
      { status: 400 }
    );
  }

  // If no patientId provided but we have patient details, auto-create a Patient record
  let patientId = body.patientId || null;
  if (!patientId && body.patientName && body.deliveryAddress) {
    const patient = await prisma.patient.create({
      data: {
        name: body.patientName,
        phone: body.patientPhone || null,
        address: body.deliveryAddress,
        city: body.deliveryCity,
        postalCode: body.deliveryPostalCode,
        storeId: store.id,
      },
    });
    patientId = patient.id;
  }

  const recurringOrder = await prisma.recurringOrder.create({
    data: {
      patientId,
      patientName: body.patientName,
      patientPhone: body.patientPhone || null,
      deliveryAddress: body.deliveryAddress,
      deliveryCity: body.deliveryCity,
      deliveryPostalCode: body.deliveryPostalCode,
      deliveryZoneId: body.deliveryZoneId,
      instructions: body.instructions || null,
      activeDays: JSON.stringify(activeDays),
      createdById: session.user.id,
      storeId: store.id,
    },
  });

  return NextResponse.json(recurringOrder, { status: 201 });
}
