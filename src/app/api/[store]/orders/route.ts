import { NextRequest, NextResponse } from "next/server";
import { Prisma, type ExternalDispatch, type ExternalPlan } from "@prisma/client";
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
  buildSpokePlanKey,
  buildSpokePlanTitle,
  buildSpokeStopPayload,
  createSpokePlan,
  distributeSpokePlan,
  getSpokeConfig,
  importSpokeStop,
  optimizeSpokePlan,
  parseScheduledDateKey,
  shouldRouteToSpoke,
  SpokeDispatchError,
  spokeDatePartsFromKey,
  spokePlanDateFromKey,
  waitForSpokeOperation,
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
  workflowStep?: string | null;
  requestPayload: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
  externalReference?: string | null;
  externalPlanId?: string | null;
  spokePlanId?: string | null;
  spokeStopId?: string | null;
  spokeDriverId?: string | null;
  spokeOperationId?: string | null;
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
    workflowStep: input.workflowStep ?? null,
    externalReference: input.externalReference ?? null,
    externalPlanId: input.externalPlanId ?? null,
    spokePlanId: input.spokePlanId ?? null,
    spokeStopId: input.spokeStopId ?? null,
    spokeDriverId: input.spokeDriverId ?? null,
    spokeOperationId: input.spokeOperationId ?? null,
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

function buildExternalDispatchResponse(dispatch: Pick<ExternalDispatch, "id" | "provider" | "externalReference" | "spokePlanId" | "spokeStopId" | "status">) {
  return {
    external: true,
    provider: dispatch.provider,
    externalReference: dispatch.externalReference,
    spokePlanId: dispatch.spokePlanId,
    spokeStopId: dispatch.spokeStopId,
    dispatchId: dispatch.id,
    status: dispatch.status,
  };
}

function isTerminalExternalDispatch(dispatch: ExternalDispatch) {
  return [
    "DISTRIBUTED",
    "ALLOCATED",
    "IN_TRANSIT",
    "DEPARTED",
    "TRACKING_LINK_ADDED",
    "DELIVERED",
    "DELIVERY_FAILED",
  ].includes(dispatch.status);
}

async function ensureSpokePlanRecord(input: {
  storeId: string;
  storeName: string;
  selectedProviderUserId: string | null;
  providerName: string | null;
  scheduledDateKey: string;
  spokeDriverId: string;
}) {
  const planKey = buildSpokePlanKey({
    storeId: input.storeId,
    providerUserId: input.selectedProviderUserId,
    scheduledDateKey: input.scheduledDateKey,
  });
  const title = buildSpokePlanTitle({
    storeName: input.storeName,
    providerName: input.providerName,
    scheduledDateKey: input.scheduledDateKey,
  });

  return prisma.externalPlan.upsert({
    where: { planKey },
    update: {
      title,
      spokeDriverId: input.spokeDriverId,
      selectedProviderUserId: input.selectedProviderUserId,
    },
    create: {
      planKey,
      provider: "SPOKE",
      status: "PENDING",
      title,
      scheduledDate: spokePlanDateFromKey(input.scheduledDateKey),
      spokeDriverId: input.spokeDriverId,
      selectedProviderUserId: input.selectedProviderUserId,
      storeId: input.storeId,
    },
  });
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
    deliveryAddress = addr.address;
    deliveryCity = addr.city;
    deliveryPostalCode = addr.postalCode;
  }

  const instructions = data.instructions || null;
  const scheduledDate = new Date(data.scheduledDate);
  const scheduledDateKey = parseScheduledDateKey(data.scheduledDate, scheduledDate);
  const routeToSpoke = shouldRouteToSpoke({
    assignedDriverId,
    isExternalProvider: data.isExternalProvider === true,
    deliveryCompany: cleanOptionalText(data.delivery_company),
  });

  const existingExternalDispatch = await prisma.externalDispatch.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (existingExternalDispatch) {
    if (existingExternalDispatch.storeId !== store.id || !routeToSpoke) {
      return NextResponse.json(
        { error: "Idempotency key conflict" },
        { status: 409 }
      );
    }
    if (isTerminalExternalDispatch(existingExternalDispatch)) {
      return NextResponse.json(
        buildExternalDispatchResponse(existingExternalDispatch),
        { status: 200 }
      );
    }
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
    let externalPlan: ExternalPlan | null = null;
    let dispatch: ExternalDispatch | null = existingExternalDispatch;

    try {
      const spokeConfig = getSpokeConfig();
      const spokeInput: SpokeOrderInput = {
        idempotencyKey: data.idempotencyKey,
        patientId,
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
        scheduledDateKey,
      };
      const stopPayload = buildSpokeStopPayload(spokeInput, spokeConfig.spokeDriverId);

      externalPlan = await ensureSpokePlanRecord({
        storeId: store.id,
        storeName: store.name,
        selectedProviderUserId: assignedDriverId,
        providerName: assignedDriver?.name ?? "Anchor",
        scheduledDateKey,
        spokeDriverId: spokeConfig.spokeDriverId,
      });

      const baseAudit = {
        requestPayload: stopPayload,
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
        externalPlanId: externalPlan.id,
        spokePlanId: externalPlan.spokePlanId,
        spokeDriverId: spokeConfig.spokeDriverId,
      };

      dispatch = await prisma.externalDispatch.upsert({
        where: { idempotencyKey: data.idempotencyKey },
        update: buildExternalDispatchAuditData({
          ...baseAudit,
          status: dispatch?.status ?? "PENDING",
          workflowStep: dispatch?.workflowStep ?? "PENDING",
          spokeStopId: dispatch?.spokeStopId,
          externalReference: dispatch?.externalReference,
          spokeOperationId: dispatch?.spokeOperationId,
          responsePayload: dispatch?.responsePayload,
          errorMessage: null,
        }),
        create: {
          idempotencyKey: data.idempotencyKey,
          ...buildExternalDispatchAuditData({
            ...baseAudit,
            status: "PENDING",
            workflowStep: "PENDING",
            errorMessage: null,
          }),
        },
      });

      if (!externalPlan.spokePlanId) {
        const planResult = await createSpokePlan(spokeConfig, {
          title: externalPlan.title,
          starts: spokeDatePartsFromKey(scheduledDateKey),
          idempotencyKey: data.idempotencyKey,
        });
        externalPlan = await prisma.externalPlan.update({
          where: { id: externalPlan.id },
          data: {
            status: "CREATED",
            spokePlanId: planResult.planId,
            lastRequestPayload: asPrismaJson(planResult.requestPayload),
            lastResponsePayload: asPrismaJson(planResult.responsePayload),
            errorMessage: null,
          },
        });
        dispatch = await prisma.externalDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: "PLAN_CREATED",
            workflowStep: "CREATE_PLAN",
            spokePlanId: planResult.planId,
            responsePayload: asPrismaJson(planResult.responsePayload),
            errorMessage: null,
          },
        });
      }

      const spokePlanId = externalPlan.spokePlanId;
      if (!spokePlanId) {
        throw new SpokeDispatchError(
          "Spoke plan could not be created.",
          502,
          null,
          "CREATE_PLAN"
        );
      }

      const livePlan = externalPlan.status === "DISTRIBUTED";
      let spokeStopId = dispatch.spokeStopId;
      if (!spokeStopId) {
        const importResult = await importSpokeStop(spokeConfig, {
          planId: spokePlanId,
          stopPayload,
          live: livePlan,
          idempotencyKey: data.idempotencyKey,
        });
        spokeStopId = importResult.stopId;
        dispatch = await prisma.externalDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: "STOP_IMPORTED",
            workflowStep: livePlan ? "LIVE_IMPORT_STOP" : "IMPORT_STOP",
            spokePlanId,
            spokeStopId,
            externalReference: spokeStopId,
            responsePayload: asPrismaJson(importResult.responsePayload),
            errorMessage: null,
          },
        });
      }

      const operationResult = await optimizeSpokePlan(spokeConfig, {
        planId: spokePlanId,
        live: livePlan,
        idempotencyKey: data.idempotencyKey,
      });
      await prisma.externalPlan.update({
        where: { id: externalPlan.id },
        data: {
          status: "OPTIMIZING",
          lastOperationId: operationResult.operationId,
          lastRequestPayload: asPrismaJson(operationResult.requestPayload),
          lastResponsePayload: asPrismaJson(operationResult.responsePayload),
          errorMessage: null,
        },
      });
      dispatch = await prisma.externalDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: "OPTIMIZING",
          workflowStep: livePlan ? "REOPTIMIZE_PLAN" : "OPTIMIZE_PLAN",
          spokeOperationId: operationResult.operationId,
          responsePayload: asPrismaJson(operationResult.responsePayload),
          errorMessage: null,
        },
      });

      const completedOperation = await waitForSpokeOperation(spokeConfig, {
        operationId: operationResult.operationId,
        stopId: spokeStopId,
      });
      await prisma.externalPlan.update({
        where: { id: externalPlan.id },
        data: {
          status: "OPTIMIZED",
          lastResponsePayload: asPrismaJson(completedOperation.responsePayload),
          errorMessage: null,
        },
      });

      const distributeResult = await distributeSpokePlan(spokeConfig, {
        planId: spokePlanId,
        live: livePlan,
        idempotencyKey: data.idempotencyKey,
      });

      const finalDispatch = await prisma.$transaction(async (tx) => {
        const { finalPatientId, finalAddressId } = await savePatientAddress(tx);

        await tx.externalPlan.update({
          where: { id: externalPlan!.id },
          data: {
            status: "DISTRIBUTED",
            lastRequestPayload: asPrismaJson(distributeResult.requestPayload),
            lastResponsePayload: asPrismaJson(distributeResult.responsePayload),
            errorMessage: null,
          },
        });

        return tx.externalDispatch.update({
          where: { id: dispatch!.id },
          data: {
            status: "DISTRIBUTED",
            workflowStep: livePlan ? "REDISTRIBUTE_PLAN" : "DISTRIBUTE_PLAN",
            externalReference: spokeStopId,
            spokePlanId,
            spokeStopId,
            spokeDriverId: spokeConfig.spokeDriverId,
            patientId: finalPatientId,
            deliveryAddressId: finalAddressId,
            responsePayload: asPrismaJson(distributeResult.responsePayload),
            errorMessage: null,
          },
        });
      });

      return NextResponse.json(
        buildExternalDispatchResponse(finalDispatch),
        { status: existingExternalDispatch ? 200 : 201 }
      );
    } catch (err) {
      const spokeError =
        err instanceof SpokeDispatchError
          ? err
          : new SpokeDispatchError("Failed to contact Spoke.", 502);

      if (dispatch) {
        await prisma.externalDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: "DISPATCH_FAILED",
            workflowStep: spokeError.workflowStep,
            responsePayload: asPrismaJson(spokeError.responsePayload),
            errorMessage: spokeError.message,
          },
        });
      }
      if (externalPlan) {
        await prisma.externalPlan.update({
          where: { id: externalPlan.id },
          data: {
            status: externalPlan.status === "DISTRIBUTED" ? "DISTRIBUTED" : "FAILED",
            lastResponsePayload: asPrismaJson(spokeError.responsePayload),
            errorMessage: spokeError.message,
          },
        });
      }

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
