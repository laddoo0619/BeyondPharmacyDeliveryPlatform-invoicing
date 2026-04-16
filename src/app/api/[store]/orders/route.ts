import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { z } from "zod";

const createOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  patientId: z.string().optional(),
  patientName: z.string().min(1),
  patientPhone: z.string().optional().default(""),
  deliveryAddress: z.string().min(1),
  deliveryCity: z.string().min(1),
  deliveryPostalCode: z.string().min(1),
  deliveryAddressId: z.string().optional(),
  saveAddressToPatient: z.boolean().optional().default(false),
  deliveryZoneId: z.string().min(1),
  instructions: z.string().optional().default(""),
  scheduledDate: z.string().min(1),
  assignedDriverId: z.string().optional(),
});

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
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Idempotency: if a previous request with this key already produced an order,
  // return it instead of inserting again.
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existing) {
    if (existing.storeId !== store.id) {
      return NextResponse.json(
        { error: "Idempotency key conflict" },
        { status: 409 }
      );
    }
    return NextResponse.json(existing, { status: 200 });
  }

  // Verify zone belongs to store and snapshot its price
  const zone = await prisma.deliveryZone.findUnique({
    where: { id: data.deliveryZoneId, storeId: store.id },
  });

  if (!zone) {
    return NextResponse.json({ error: "Invalid delivery zone" }, { status: 400 });
  }

  let assignedDriverId: string | null = null;
  if (data.assignedDriverId) {
    const driver = await prisma.user.findUnique({
      where: { id: data.assignedDriverId },
    });
    if (!driver || driver.role !== "DRIVER" || !driver.isActive || driver.storeId !== store.id) {
      return NextResponse.json({ error: "Invalid driver" }, { status: 400 });
    }
    assignedDriverId = driver.id;
  }

  // Verify patient belongs to store if provided
  let patientId: string | null = null;
  if (data.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, storeId: store.id },
    });
    if (!patient) {
      return NextResponse.json({ error: "Invalid patient" }, { status: 400 });
    }
    patientId = patient.id;
  }

  // Verify the chosen saved address belongs to the chosen patient
  let deliveryAddressId: string | null = null;
  let deliveryAddress = data.deliveryAddress;
  let deliveryCity = data.deliveryCity;
  let deliveryPostalCode = data.deliveryPostalCode;
  if (data.deliveryAddressId) {
    if (!patientId) {
      return NextResponse.json(
        { error: "Saved address requires a patient selection" },
        { status: 400 }
      );
    }
    const addr = await prisma.address.findFirst({
      where: { id: data.deliveryAddressId, patientId },
    });
    if (!addr) {
      return NextResponse.json({ error: "Invalid saved address" }, { status: 400 });
    }
    deliveryAddressId = addr.id;
    // Snapshot from the saved address so the order is authoritative.
    deliveryAddress = addr.address;
    deliveryCity = addr.city;
    deliveryPostalCode = addr.postalCode;
  }

  const orderData = {
    idempotencyKey: data.idempotencyKey,
    patientId,
    patientName: data.patientName,
    patientPhone: data.patientPhone || null,
    deliveryAddress,
    deliveryCity,
    deliveryPostalCode,
    deliveryAddressId,
    deliveryZoneId: data.deliveryZoneId,
    deliveryZoneName: zone.name,
    priceAtCreation: zone.price,
    instructions: data.instructions || null,
    scheduledDate: new Date(data.scheduledDate),
    status: assignedDriverId ? "ASSIGNED" : "PENDING",
    assignedDriverId,
    createdById: session.user.id,
    storeId: store.id,
  };

  try {
    const order = await prisma.$transaction(async (tx) => {
      let finalAddressId = deliveryAddressId;

      // Persist the typed address to the patient's address book when requested
      if (data.saveAddressToPatient && patientId && !deliveryAddressId) {
        const created = await tx.address.create({
          data: {
            patientId,
            label: "Saved",
            address: deliveryAddress,
            city: deliveryCity,
            postalCode: deliveryPostalCode,
            isDefault: false,
          },
        });
        finalAddressId = created.id;
      }

      return tx.order.create({
        data: { ...orderData, deliveryAddressId: finalAddressId },
      });
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    // Race: another concurrent request won the idempotency-key insert.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      Array.isArray(err.meta?.target) &&
      (err.meta?.target as string[]).includes("idempotencyKey")
    ) {
      const winner = await prisma.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (winner && winner.storeId === store.id) {
        return NextResponse.json(winner, { status: 200 });
      }
    }
    throw err;
  }
}

export async function GET(
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

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { assignedDriver: true, deliveryZone: true },
    orderBy: { scheduledDate: "desc" },
  });

  return NextResponse.json(orders);
}
