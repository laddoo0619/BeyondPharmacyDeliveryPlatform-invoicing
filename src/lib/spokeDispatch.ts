import { Prisma, type ExternalDispatch, type ExternalPlan } from "@prisma/client";
import { prisma } from "./db";
import {
  buildSpokePlanKey,
  buildSpokePlanTitle,
  buildSpokeStopPayload,
  createSpokePlan,
  createSpokeStop,
  distributeSpokePlan,
  getSpokeConfig,
  getSpokeProviderUserIds,
  optimizeSpokePlan,
  SpokeDispatchError,
  spokeDatePartsFromKey,
  spokePlanDateFromKey,
  waitForSpokeOperation,
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
    "DELIVERED",
    "DELIVERY_FAILED",
  ].includes(dispatch.status);
}

function isLiveSpokePlan(plan: Pick<ExternalPlan, "status">) {
  return plan.status === "OPTIMIZED" || plan.status === "DISTRIBUTED";
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

export async function dispatchOrderToSpoke(
  input: SpokeDispatchInput
): Promise<SpokeDispatchResult> {
  let externalPlan: ExternalPlan | null = null;
  let dispatch = await prisma.externalDispatch.findUnique({
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

  try {
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
    const stopPayload = buildSpokeStopPayload(spokeInput, spokeConfig.spokeDriverId);

    externalPlan = await ensureSpokePlanRecord({
      storeId: input.store.id,
      storeName: input.store.name,
      selectedProviderUserId: input.selectedProviderUser?.id ?? null,
      providerName: input.selectedProviderUser?.name ?? "Anchor",
      scheduledDateKey: input.scheduledDateKey,
      spokeDriverId: spokeConfig.spokeDriverId,
    });

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
      externalPlanId: externalPlan.id,
      spokePlanId: externalPlan.spokePlanId,
      spokeDriverId: spokeConfig.spokeDriverId,
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

    if (!externalPlan.spokePlanId) {
      const planResult = await createSpokePlan(spokeConfig, {
        title: externalPlan.title,
        starts: spokeDatePartsFromKey(input.scheduledDateKey),
        idempotencyKey: input.idempotencyKey,
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

    const livePlan = isLiveSpokePlan(externalPlan);
    let spokeStopId = dispatch.spokeStopId;
    if (!spokeStopId) {
      const stopResult = await createSpokeStop(spokeConfig, {
        planId: spokePlanId,
        stopPayload,
        live: livePlan,
        idempotencyKey: input.idempotencyKey,
      });
      spokeStopId = stopResult.stopId;
      dispatch = await prisma.externalDispatch.update({
        where: { id: dispatch.id },
        data: {
          status: "STOP_CREATED",
          workflowStep: livePlan ? "LIVE_CREATE_STOP" : "CREATE_STOP",
          spokePlanId,
          spokeStopId,
          externalReference: spokeStopId,
          responsePayload: asPrismaJson(stopResult.responsePayload),
          errorMessage: null,
        },
      });
    }

    const operationResult = await optimizeSpokePlan(spokeConfig, {
      planId: spokePlanId,
      live: livePlan,
      idempotencyKey: input.idempotencyKey,
    });
    externalPlan = await prisma.externalPlan.update({
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
    externalPlan = await prisma.externalPlan.update({
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
      idempotencyKey: input.idempotencyKey,
    });

    const finalDispatch = await prisma.$transaction(async (tx) => {
      const finalSnapshot = input.onBeforeComplete
        ? await input.onBeforeComplete(tx)
        : {
            patientId: input.patientId,
            deliveryAddressId: input.deliveryAddressId,
          };

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
          patientId: finalSnapshot.patientId,
          deliveryAddressId: finalSnapshot.deliveryAddressId,
          responsePayload: asPrismaJson(distributeResult.responsePayload),
          errorMessage: null,
        },
      });
    });

    return { dispatch: finalDispatch, alreadyDispatched: false };
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
          status: isLiveSpokePlan(externalPlan) ? externalPlan.status : "FAILED",
          lastResponsePayload: asPrismaJson(spokeError.responsePayload),
          errorMessage: spokeError.message,
        },
      });
    }

    throw spokeError;
  }
}
