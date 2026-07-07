import { Prisma, type ExternalDispatch } from "@prisma/client";
import { prisma } from "./db";
import {
  buildSpokeStopPayload,
  createSpokeUnassignedStop,
  getSpokeConfig,
  getSpokeProviderUserIds,
  SpokeDispatchError,
  type SpokeOrderInput,
} from "./spoke";

interface SpokeProviderUser {
  id: string;
  name: string;
  email: string;
}

interface SpokeDispatchInput {
  idempotencyKey: string;
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
  scheduledDateKey: string;
  store: {
    id: string;
    slug: string;
    name: string;
  };
  selectedProviderUser: SpokeProviderUser | null;
  createdById: string;
  onBeforeComplete?: (
    tx: Prisma.TransactionClient
  ) => Promise<{ patientId: string | null; deliveryAddressId: string | null }>;
}

export function buildRecurringSpokeIdempotencyKey(
  recurringOrderId: string,
  scheduledDateKey: string
) {
  return `recurring:${recurringOrderId}:${scheduledDateKey}`;
}

export interface SpokeDispatchResult {
  dispatch: ExternalDispatch;
  alreadyDispatched: boolean;
}

function asPrismaJson(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function buildExternalDispatchAuditData(input: {
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
}) {
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

export function buildExternalDispatchResponse(
  dispatch: Pick<
    ExternalDispatch,
    "id" | "provider" | "externalReference" | "spokePlanId" | "spokeStopId" | "status"
  >
) {
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

export function isSelectedSpokeProvider(userId: string | null | undefined) {
  return userId ? getSpokeProviderUserIds().has(userId) : false;
}

function isTerminalExternalDispatch(dispatch: ExternalDispatch) {
  return [
    "DISTRIBUTED",
    "ALLOCATED",
    "IN_TRANSIT",
    "DEPARTED",
    "TRACKING_LINK_ADDED",
    "SUBMITTED",
    "DELIVERED",
    "DELIVERY_FAILED",
    "CANCELLED",
  ].includes(dispatch.status);
}

function toSpokeDispatchError(err: unknown) {
  if (err instanceof SpokeDispatchError) return err;

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022")
  ) {
    return new SpokeDispatchError(
      "Spoke dispatch audit is unavailable. Please confirm the Spoke database migration has run.",
      500,
      null,
      "SETUP"
    );
  }

  return new SpokeDispatchError("Failed to contact Spoke.", 502);
}

export async function dispatchOrderToSpoke(
  input: SpokeDispatchInput
): Promise<SpokeDispatchResult> {
  let dispatch: ExternalDispatch | null = null;

  try {
    dispatch = await prisma.externalDispatch.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (dispatch) {
      if (dispatch.storeId !== input.store.id) {
        throw new SpokeDispatchError(
          "Idempotency key conflict",
          409,
          null,
          "IDEMPOTENCY"
        );
      }
      if (isTerminalExternalDispatch(dispatch)) {
        return { dispatch, alreadyDispatched: true };
      }
    }

    const spokeConfig = getSpokeConfig();
    const spokeInput: SpokeOrderInput = {
      idempotencyKey: input.idempotencyKey,
      patientId: input.patientId,
      store: input.store,
      providerUser: input.selectedProviderUser,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      deliveryAddress: input.deliveryAddress,
      deliveryCity: input.deliveryCity,
      deliveryPostalCode: input.deliveryPostalCode,
      deliveryZoneName: input.deliveryZoneName,
      instructions: input.instructions,
      scheduledDate: input.scheduledDate,
      scheduledDateKey: input.scheduledDateKey,
    };
    const stopPayload = buildSpokeStopPayload(spokeInput, spokeConfig.circuitClientId);

    const baseAudit = {
      requestPayload: stopPayload,
      selectedProviderUserId: input.selectedProviderUser?.id ?? null,
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
      storeId: input.store.id,
      createdById: input.createdById,
      externalPlanId: null,
      spokePlanId: null,
      spokeDriverId: null,
    };

    dispatch = await prisma.externalDispatch.upsert({
      where: { idempotencyKey: input.idempotencyKey },
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
        idempotencyKey: input.idempotencyKey,
        ...buildExternalDispatchAuditData({
          ...baseAudit,
          status: "PENDING",
          workflowStep: "PENDING",
          errorMessage: null,
        }),
      },
    });

    let spokeStopId = dispatch.spokeStopId;
    if (!spokeStopId) {
      const stopResult = await createSpokeUnassignedStop(spokeConfig, {
        stopPayload,
        idempotencyKey: input.idempotencyKey,
      });
      spokeStopId = stopResult.stopId;
      dispatch = await prisma.externalDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: "STOP_CREATED",
          workflowStep: "CREATE_UNASSIGNED_STOP",
          spokePlanId: null,
          spokeStopId,
          externalReference: spokeStopId,
          responsePayload: asPrismaJson(stopResult.responsePayload),
          errorMessage: null,
        },
      });
    }

    const finalDispatch = await prisma.$transaction(async (tx) => {
      const finalSnapshot = input.onBeforeComplete
        ? await input.onBeforeComplete(tx)
        : {
            patientId: input.patientId,
            deliveryAddressId: input.deliveryAddressId,
          };

      return tx.externalDispatch.update({
        where: { id: dispatch!.id },
        data: {
          status: "SUBMITTED",
          workflowStep: "CREATE_UNASSIGNED_STOP",
          externalReference: spokeStopId,
          spokePlanId: null,
          spokeStopId,
          spokeDriverId: null,
          patientId: finalSnapshot.patientId,
          deliveryAddressId: finalSnapshot.deliveryAddressId,
          errorMessage: null,
        },
      });
    });

    return { dispatch: finalDispatch, alreadyDispatched: false };
  } catch (err) {
    const spokeError = toSpokeDispatchError(err);

    if (dispatch) {
      try {
        await prisma.externalDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: "DISPATCH_FAILED",
            workflowStep: spokeError.workflowStep,
            responsePayload: asPrismaJson(spokeError.responsePayload),
            errorMessage: spokeError.message,
          },
        });
      } catch (auditError) {
        console.warn("[SPOKE] Failed to update dispatch failure audit:", auditError);
      }
    }

    throw spokeError;
  }
}

// Records a Spoke handoff WITHOUT contacting Spoke, for orders whose delivery
// day hasn't arrived yet. Unassigned stops carry no machine-readable date, so a
// stop created days early sits in Anchor's queue and never lands on the right
// day's plan (Shirley Heap, Jul 6 2026). The daily cron releases these through
// dispatchOrderToSpoke (same idempotency key) on the morning of delivery —
// "SCHEDULED" is deliberately not a terminal status, so the release proceeds.
export async function scheduleDeferredSpokeDispatch(
  input: SpokeDispatchInput
): Promise<SpokeDispatchResult> {
  try {
    const existing = await prisma.externalDispatch.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      if (existing.storeId !== input.store.id) {
        throw new SpokeDispatchError(
          "Idempotency key conflict",
          409,
          null,
          "IDEMPOTENCY"
        );
      }
      if (isTerminalExternalDispatch(existing) || existing.status === "SCHEDULED") {
        return { dispatch: existing, alreadyDispatched: true };
      }
    }

    // Build the same payload the release step will send, for the audit trail
    // (also surfaces a missing SPOKE_API_KEY now rather than at 6 AM).
    const spokeConfig = getSpokeConfig();
    const stopPayload = buildSpokeStopPayload(
      {
        idempotencyKey: input.idempotencyKey,
        patientId: input.patientId,
        store: input.store,
        providerUser: input.selectedProviderUser,
        patientName: input.patientName,
        patientPhone: input.patientPhone,
        deliveryAddress: input.deliveryAddress,
        deliveryCity: input.deliveryCity,
        deliveryPostalCode: input.deliveryPostalCode,
        deliveryZoneName: input.deliveryZoneName,
        instructions: input.instructions,
        scheduledDate: input.scheduledDate,
        scheduledDateKey: input.scheduledDateKey,
      },
      spokeConfig.circuitClientId
    );

    const dispatch = await prisma.$transaction(async (tx) => {
      const snapshot = input.onBeforeComplete
        ? await input.onBeforeComplete(tx)
        : {
            patientId: input.patientId,
            deliveryAddressId: input.deliveryAddressId,
          };

      const auditData = buildExternalDispatchAuditData({
        status: "SCHEDULED",
        workflowStep: "AWAITING_RELEASE",
        requestPayload: stopPayload,
        selectedProviderUserId: input.selectedProviderUser?.id ?? null,
        patientId: snapshot.patientId,
        patientName: input.patientName,
        patientPhone: input.patientPhone,
        deliveryAddress: input.deliveryAddress,
        deliveryCity: input.deliveryCity,
        deliveryPostalCode: input.deliveryPostalCode,
        deliveryAddressId: snapshot.deliveryAddressId,
        deliveryZoneId: input.deliveryZoneId,
        deliveryZoneName: input.deliveryZoneName,
        priceAtCreation: input.priceAtCreation,
        instructions: input.instructions,
        scheduledDate: input.scheduledDate,
        storeId: input.store.id,
        createdById: input.createdById,
        externalPlanId: null,
        spokePlanId: null,
        spokeDriverId: null,
        errorMessage: null,
      });

      return tx.externalDispatch.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        update: auditData,
        create: { idempotencyKey: input.idempotencyKey, ...auditData },
      });
    });

    return { dispatch, alreadyDispatched: false };
  } catch (err) {
    throw toSpokeDispatchError(err);
  }
}
