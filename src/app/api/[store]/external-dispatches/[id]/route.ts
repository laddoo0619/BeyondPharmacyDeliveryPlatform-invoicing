import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteSpokeUnassignedStop, getSpokeConfig, SpokeDispatchError } from "@/lib/spoke";
import { resolveStore } from "@/lib/store";

const CANCELLABLE_EXTERNAL_STATUSES = new Set([
  "SCHEDULED",
  "PENDING",
  "STOP_CREATED",
  "SUBMITTED",
]);

function asPrismaJson(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.storeId && session.user.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dispatch = await prisma.externalDispatch.findUnique({
    where: { id },
  });

  if (!dispatch || dispatch.storeId !== store.id || dispatch.provider !== "SPOKE") {
    return NextResponse.json({ error: "External dispatch not found" }, { status: 404 });
  }

  if (dispatch.status === "CANCELLED") {
    return NextResponse.json({ message: "Spoke handoff already cancelled.", dispatch });
  }

  if (!CANCELLABLE_EXTERNAL_STATUSES.has(dispatch.status)) {
    return NextResponse.json(
      {
        error:
          "This Spoke handoff can no longer be cancelled from the pharmacy portal because Anchor has already started handling it.",
      },
      { status: 409 }
    );
  }

  if (!dispatch.spokeStopId) {
    const cancelled = await prisma.externalDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: "CANCELLED",
        workflowStep: "CANCEL_UNASSIGNED_STOP",
        errorMessage: null,
      },
    });

    return NextResponse.json({
      message: "Spoke handoff cancelled before it reached Spoke.",
      dispatch: cancelled,
    });
  }

  if (!dispatch.spokeStopId.startsWith("unassignedStops/")) {
    return NextResponse.json(
      {
        error:
          "Only unassigned Spoke handoffs can be cancelled from the pharmacy portal.",
      },
      { status: 409 }
    );
  }

  try {
    const spokeConfig = getSpokeConfig();
    const result = await deleteSpokeUnassignedStop(spokeConfig, {
      unassignedStopId: dispatch.spokeStopId,
      idempotencyKey: dispatch.idempotencyKey,
    });

    const cancelled = await prisma.externalDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: "CANCELLED",
        workflowStep: "CANCEL_UNASSIGNED_STOP",
        responsePayload: asPrismaJson(result.responsePayload),
        errorMessage: null,
      },
    });

    return NextResponse.json({
      message: "Spoke unassigned stop cancelled.",
      dispatch: cancelled,
    });
  } catch (err) {
    const spokeError =
      err instanceof SpokeDispatchError
        ? err
        : new SpokeDispatchError("Failed to cancel Spoke handoff.", 502);

    await prisma.externalDispatch.update({
      where: { id: dispatch.id },
      data: {
        workflowStep: spokeError.workflowStep,
        responsePayload: asPrismaJson(spokeError.responsePayload),
        errorMessage: spokeError.message,
      },
    });

    return NextResponse.json(
      { error: spokeError.message, external: true, provider: "SPOKE" },
      { status: spokeError.statusCode }
    );
  }
}
