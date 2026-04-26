import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";

interface DriverCandidate {
  id: string;
  role: string;
  isActive: boolean;
  storeId: string | null;
}

function normalizeOptionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isValidStoreDriver(
  driver: DriverCandidate | null | undefined,
  storeId: string
): driver is DriverCandidate {
  return !!driver && driver.role === "DRIVER" && driver.isActive && driver.storeId === storeId;
}

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
  const assignedDriverId = normalizeOptionalId(body.assignedDriverId);

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

  const zone = await prisma.deliveryZone.findFirst({
    where: { id: body.deliveryZoneId, storeId: store.id, isActive: true },
    include: {
      defaultDriver: {
        select: { id: true, role: true, isActive: true, storeId: true },
      },
    },
  });

  if (!zone) {
    return NextResponse.json({ error: "Invalid delivery zone" }, { status: 400 });
  }

  if (assignedDriverId) {
    const driver = await prisma.user.findFirst({
      where: {
        id: assignedDriverId,
        role: "DRIVER",
        isActive: true,
        storeId: store.id,
      },
      select: { id: true },
    });

    if (!driver) {
      return NextResponse.json({ error: "Invalid driver" }, { status: 400 });
    }
  }

  if (body.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: body.patientId, storeId: store.id },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Invalid patient" }, { status: 400 });
    }
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
      deliveryZoneId: zone.id,
      instructions: body.instructions || null,
      assignedDriverId,
      activeDays: JSON.stringify(activeDays),
      createdById: session.user.id,
      storeId: store.id,
    },
    include: { deliveryZone: true },
  });

  // If today is an active day, immediately create today's Order so it appears in the driver portal
  const deliveryDate = getVancouverDeliveryDateInfo();
  if (activeDays.includes(deliveryDate.dayOfWeek)) {
    const defaultDriverId = isValidStoreDriver(zone.defaultDriver, store.id)
      ? zone.defaultDriver.id
      : null;
    const driverId = assignedDriverId || defaultDriverId;
    const status = driverId ? "ASSIGNED" : "PENDING";
    try {
      await prisma.order.create({
        data: {
          patientName: body.patientName,
          patientPhone: body.patientPhone || null,
          deliveryAddress: body.deliveryAddress,
          deliveryCity: body.deliveryCity,
          deliveryPostalCode: body.deliveryPostalCode,
          deliveryZoneId: zone.id,
          deliveryZoneName: recurringOrder.deliveryZone.name,
          priceAtCreation: recurringOrder.deliveryZone.price,
          instructions: body.instructions || null,
          status,
          assignedDriverId: driverId,
          scheduledDate: deliveryDate.dayStart,
          recurringOrderId: recurringOrder.id,
          createdById: session.user.id,
          storeId: store.id,
        },
      });
    } catch {
      // Dedup: order may already exist for today (e.g. cron already ran)
    }
  }

  return NextResponse.json(recurringOrder, { status: 201 });
}
