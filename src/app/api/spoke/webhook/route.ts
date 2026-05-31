import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { mapSpokeWebhookStatus, verifySpokeSignature } from "@/lib/spoke";

function asPrismaJson(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function objectPayload(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readStopId(eventType: string, data: Record<string, unknown>) {
  if (eventType === "test.send_event") return null;
  const directId = data.id;
  return typeof directId === "string" && directId.trim() ? directId.trim() : null;
}

function readTrackingLink(data: Record<string, unknown>) {
  const value = data.trackingLink;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSellerOrderId(data: Record<string, unknown>) {
  const directOrderInfo = objectPayload(data.orderInfo);
  const directSellerOrderId = directOrderInfo?.sellerOrderId;
  if (typeof directSellerOrderId === "string" && directSellerOrderId.trim()) {
    return directSellerOrderId.trim();
  }

  const stop = objectPayload(data.stop);
  const stopOrderInfo = objectPayload(stop?.orderInfo);
  const stopSellerOrderId = stopOrderInfo?.sellerOrderId;
  return typeof stopSellerOrderId === "string" && stopSellerOrderId.trim()
    ? stopSellerOrderId.trim()
    : null;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.SPOKE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Spoke webhook secret is not configured" },
      { status: 500 }
    );
  }

  const rawBody = await req.text();
  const isValid = verifySpokeSignature({
    rawBody,
    signature: req.headers.get("spoke-signature"),
    secret: webhookSecret,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventPayload = objectPayload(event);
  const eventType = typeof eventPayload?.type === "string" ? eventPayload.type : "";
  const data = objectPayload(eventPayload?.data) ?? {};

  if (eventType === "test.send_event") {
    return NextResponse.json({ ok: true });
  }

  const stopId = readStopId(eventType, data);
  if (!stopId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const mapped = mapSpokeWebhookStatus(eventType, data);
  const attemptTimestamps = {
    ...("deliveredAt" in mapped ? { deliveredAt: mapped.deliveredAt } : {}),
    ...("failedAt" in mapped ? { failedAt: mapped.failedAt } : {}),
  };
  const updateData = {
    status: mapped.status,
    lastWebhookEventType: eventType,
    webhookPayload: asPrismaJson(eventPayload),
    trackingLink: readTrackingLink(data),
    spokeStopId: stopId,
    externalReference: stopId,
    ...attemptTimestamps,
    errorMessage: null,
  };
  // Webhooks are not guaranteed to arrive in order. Never let a late event drag a dispatch
  // back out of a settled terminal state — e.g. a delayed `stop.allocated` overwriting a
  // recorded DELIVERED, or un-cancelling a pharmacy-cancelled handoff. The notIn guard is
  // applied atomically in the updateMany so concurrent webhooks stay race-safe.
  // DELIVERY_FAILED is intentionally NOT protected: a re-attempted delivery that later
  // succeeds must still be able to progress from DELIVERY_FAILED to DELIVERED.
  const PROTECTED_TERMINAL_STATUSES = ["DELIVERED", "CANCELLED"];
  let updated = await prisma.externalDispatch.updateMany({
    where: {
      provider: "SPOKE",
      spokeStopId: stopId,
      status: { notIn: PROTECTED_TERMINAL_STATUSES },
    },
    data: updateData,
  });

  const sellerOrderId = readSellerOrderId(data);
  if (updated.count === 0 && sellerOrderId) {
    updated = await prisma.externalDispatch.updateMany({
      where: {
        provider: "SPOKE",
        idempotencyKey: sellerOrderId,
        status: { notIn: PROTECTED_TERMINAL_STATUSES },
      },
      data: updateData,
    });
  }

  return NextResponse.json({ ok: true, matched: updated.count });
}
