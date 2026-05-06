import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import {
  cleanOptionalText,
  cleanText,
  createOrReuseSavedAddress,
  createPatientWithDefaultAddress,
} from "@/lib/patientAddressRecords";
import {
  buildSpokeOrderPayload,
  sendOrderToSpoke,
  shouldRouteToSpoke,
  SpokeDispatchError,
  type SpokeOrderInput,
} from "@/lib/spoke";
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
  isExternalProvider: z.boolean().optional().default(false),
  delivery_company: z.string().optional().default(""),
});

interface ExternalAuditInput {
  status: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: unknown;
  errorMessage?: string | null;
  externalReference?: string | null;
  selectedProviderUserId: string | null;
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryAddressId: string | null;
  deliveryZoneId: string;
  deliveryZoneName: string;
  priceAtCreation: number;
  instructions: string | null;
  scheduledDate: Date;
  storeId: string;
  createdById: string;
}

function asPrismaJson(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function buildExternalDispatchAuditData(input: ExternalAuditInput) {
  return {
    provider: "SPOKE",
    status: input.status,
    externalReference: input.externalReference ?? null,
    selectedProviderUserId: input.selectedProviderUserId,
    patientId: input.patientId,
    patientName: input.patientName,
    patientPhone: input.patientPhone,
    deliveryAddress: input.deliveryAddress,
    deliveryCity: input.deliveryCity,
    deliveryPostalCode: input.deliveryPostalCode,
    deliveryAddressId: input.deliveryAddressId,
    deliveryZoneId: input.deliveryZoneId,
    deliveryZoneName: input.deliveryZoneName,
    priceAtCreation: input.priceAtCreation,
    instructions: input.instructions,
    scheduledDate: input.scheduledDate,
    requestPayload: asPrismaJson(input.requestPayload),
    responsePayload: asPrismaJson(input.responsePayload),
    errorMessage: input.errorMessage ?? null,
    storeId: input.storeId,
    createdById: input.createdById,
  };
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
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const patientName = cleanText(data.patientName);
  const patientPhone = cleanOptionalText(data.patientPhone);
  const requestedPatientId = cleanOptionalText(data.patientId);
  const requestedAddressId = cleanOptionalText(data.deliveryAddressId);
  let deliveryAddress = cleanText(data.deliveryAddress);
  let deliveryCity = cleanText(data.deliveryCity);
  let deliveryPostalCode = cleanText(data.deliveryPostalCode);

  if (!patientName || !deliveryAddress || !deliveryCity || !deliveryPostalCode) {
    return NextResponse.json(
      { error: "patientName, deliveryAddress, deliveryCity, and deliveryPostalCode are required" },
      { status: 400 }
    );
  }

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

  const existingExternalDispatch = await prisma.externalDispatch.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existingExternalDispatch) {
    if (existingExternalDispatch.storeId !== store.id) {
      return NextResponse.json(
        { error: "Idempotency key conflict" },
        { status: 409 }
      );
    }
    if (existingExternalDispatch.status === "ACCEPTED") {
      return NextResponse.json(
        {
          external: true,
          provider: existingExternalDispatch.provider,
          externalReference: existingExternalDispatch.externalReference,
          dispatchId: existingExternalDispatch.id,
          status: existingExternalDispatch.status,
        },
        { status: 200 }
      );
    }
  }

  // Verify zone belongs to store and snapshot its price
  const zone = await prisma.deliveryZone.findUnique({
    where: { id: data.deliveryZoneId, storeId: store.id },
  });

  if (!zone) {
    return NextResponse.json({ error: "Invalid delivery zone" }, { status: 400 });
  }

  let assignedDriverId: string | null = null;
  let assignedDriver: { id: string; name: string; email: string } | null = null;
  if (data.assignedDriverId) {
    const driver = await prisma.user.findUnique({
      where: { id: data.assignedDriverId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        storeId: true,
      },
    });
    if (!driver || driver.role !== "DRIVER" || !driver.isActive || driver.storeId !== store.id) {
      return NextResponse.json({ error: "Invalid driver" }, { status: 400 });
    }
    assignedDriverId = driver.id;
    assignedDriver = {
      id: driver.id,
      name: driver.name,
      email: driver.email,
    };
  }

  // Verify patient belongs to store if provided
  let patientId: string | null = null;
  if (requestedPatientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: requestedPatientId, storeId: store.id },
    });
    if (!patient) {
      return NextResponse.json({ error: "Invalid patient" }, { status: 400 });
    }
    patientId = patient.id;
  }

  // Verify the chosen saved address belongs to the chosen patient
  let deliveryAddressId: string | null = null;
  if (requestedAddressId) {
    if (!patientId) {
      return NextResponse.json(
        { error: "Saved address requires a patient selection" },
        { status: 400 }
      );
    }
    const addr = await prisma.address.findFirst({
      where: { id: requestedAddressId, patientId },
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

  const instructions = data.instructions || null;
  const scheduledDate = new Date(data.scheduledDate);
  const routeToSpoke = shouldRouteToSpoke({
    assignedDriverId,
    isExternalProvider: data.isExternalProvider === true,
    deliveryCompany: cleanOptionalText(data.delivery_company),
  });

  if (existingExternalDispatch && !routeToSpoke) {
    return NextResponse.json(
      { error: "Idempotency key conflict" },
      { status: 409 }
    );
  }

  const savePatientAddress = async (tx: Prisma.TransactionClient) => {
    let finalPatientId = patientId;
    let finalAddressId = deliveryAddressId;

    if (data.saveAddressToPatient && !finalPatientId) {
      const created = await createPatientWithDefaultAddress(tx, {
        name: patientName,
        phone: patientPhone,
        address: deliveryAddress,
        city: deliveryCity,
        postalCode: deliveryPostalCode,
        storeId: store.id,
      });
      finalPatientId = created.patient.id;
      finalAddressId = created.address.id;
    } else if (data.saveAddressToPatient && finalPatientId && !finalAddressId) {
      const savedAddress = await createOrReuseSavedAddress(
        tx,
        finalPatientId,
        {
          address: deliveryAddress,
          city: deliveryCity,
          postalCode: deliveryPostalCode,
          label: "Saved",
        },
        { label: "Saved" }
      );
      finalAddressId = savedAddress.id;
    }

    return { finalPatientId, finalAddressId };
  };

  if (routeToSpoke) {
    const spokeInput: SpokeOrderInput = {
      idempotencyKey: data.idempotencyKey,
      store: {
        id: store.id,
        slug: store.slug,
        name: store.name,
      },
      providerUser: assignedDriver,
      patientName,
      patientPhone,
      deliveryAddress,
      deliveryCity,
      deliveryPostalCode,
      deliveryZoneName: zone.name,
      instructions,
      scheduledDate,
    };
    const requestPayload = buildSpokeOrderPayload(spokeInput);
    const baseAudit = {
      requestPayload,
      selectedProviderUserId: assignedDriverId,
      patientId,
      patientName,
      patientPhone,
      deliveryAddress,
      deliveryCity,
      deliveryPostalCode,
      deliveryAddressId,
      deliveryZoneId: zone.id,
      deliveryZoneName: zone.name,
      priceAtCreation: zone.price,
      instructions,
      scheduledDate,
      storeId: store.id,
      createdById: session.user.id,
    };

    await prisma.externalDispatch.upsert({
      where: { idempotencyKey: data.idempotencyKey },
      update: buildExternalDispatchAuditData({
        ...baseAudit,
        status: "PENDING",
        errorMessage: null,
      }),
      create: {
        idempotencyKey: data.idempotencyKey,
        ...buildExternalDispatchAuditData({
          ...baseAudit,
          status: "PENDING",
          errorMessage: null,
        }),
      },
    });

    try {
      const spokeResult = await sendOrderToSpoke(spokeInput);

      const dispatch = await prisma.$transaction(async (tx) => {
        const { finalPatientId, finalAddressId } = await savePatientAddress(tx);

        return tx.externalDispatch.update({
          where: { idempotencyKey: data.idempotencyKey },
          data: buildExternalDispatchAuditData({
            ...baseAudit,
            status: "ACCEPTED",
            responsePayload: spokeResult.responsePayload,
            externalReference: spokeResult.externalReference,
            patientId: finalPatientId,
            deliveryAddressId: finalAddressId,
            errorMessage: null,
          }),
        });
      });

      return NextResponse.json(
        {
          external: true,
          provider: dispatch.provider,
          externalReference: dispatch.externalReference,
          dispatchId: dispatch.id,
          status: dispatch.status,
        },
        { status: existingExternalDispatch ? 200 : 201 }
      );
    } catch (err) {
      const spokeError =
        err instanceof SpokeDispatchError
          ? err
          : new SpokeDispatchError("Failed to contact Spoke.", 502);

      await prisma.externalDispatch.update({
        where: { idempotencyKey: data.idempotencyKey },
        data: buildExternalDispatchAuditData({
          ...baseAudit,
          status: "FAILED",
          responsePayload: spokeError.responsePayload,
          errorMessage: spokeError.message,
        }),
      });

      return NextResponse.json(
        { error: spokeError.message, external: true, provider: "SPOKE" },
        { status: spokeError.statusCode }
      );
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const { finalPatientId, finalAddressId } = await savePatientAddress(tx);

      return tx.order.create({
        data: {
          idempotencyKey: data.idempotencyKey,
          patientId: finalPatientId,
          patientName,
          patientPhone,
          deliveryAddress,
          deliveryCity,
          deliveryPostalCode,
          deliveryAddressId: finalAddressId,
          deliveryZoneId: data.deliveryZoneId,
          deliveryZoneName: zone.name,
          priceAtCreation: zone.price,
          instructions,
          scheduledDate,
          status: assignedDriverId ? "ASSIGNED" : "PENDING",
          assignedDriverId,
          createdById: session.user.id,
          storeId: store.id,
        },
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
