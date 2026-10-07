import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import { recurringPeopleMatch } from "@/lib/recurringDuplicateGuard";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";
import type { Prisma } from "@prisma/client";
import DashboardView, { type DashboardDelivery } from "./DashboardView";

type DashboardOrder = Prisma.OrderGetPayload<{
  include: { assignedDriver: true; deliveryZone: true };
}>;

type DashboardExternalDispatch = Prisma.ExternalDispatchGetPayload<{
  include: { selectedProviderUser: true };
}>;


const CANCELLABLE_EXTERNAL_STATUSES = new Set([
  "PENDING",
  "STOP_CREATED",
  "SUBMITTED",
]);

function shouldReplaceDuplicateOrder(
  existing: DashboardOrder,
  candidate: DashboardOrder
) {
  if (existing.status === "CANCELLED" && candidate.status !== "CANCELLED") {
    return true;
  }
  if (existing.status !== "CANCELLED" && candidate.status === "CANCELLED") {
    return false;
  }
  return candidate.createdAt < existing.createdAt;
}

function dedupeRecurringDashboardOrders(orders: DashboardOrder[]) {
  const displayOrders: DashboardOrder[] = [];

  for (const order of orders) {
    if (!order.recurringOrderId) {
      displayOrders.push(order);
      continue;
    }

    const duplicateIndex = displayOrders.findIndex(
      (candidate) =>
        !!candidate.recurringOrderId && recurringPeopleMatch(candidate, order)
    );

    if (duplicateIndex === -1) {
      displayOrders.push(order);
    } else if (shouldReplaceDuplicateOrder(displayOrders[duplicateIndex], order)) {
      displayOrders[duplicateIndex] = order;
    }
  }

  return displayOrders.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

function toDashboardDelivery(order: DashboardOrder): DashboardDelivery {
  return {
    id: order.id,
    patientName: order.patientName,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity,
    driverName: order.assignedDriver?.name ?? null,
    status: order.status,
    priceAtCreation: order.priceAtCreation,
    failedReason: order.failedReason,
    createdAt: order.createdAt,
    isExternal: false,
    externalDispatchId: null,
    canCancelExternal: false,
  };
}

function toExternalDashboardDelivery(
  dispatch: DashboardExternalDispatch
): DashboardDelivery {
  return {
    id: `external-${dispatch.id}`,
    patientName: dispatch.patientName,
    deliveryAddress: dispatch.deliveryAddress,
    deliveryCity: dispatch.deliveryCity,
    driverName: dispatch.selectedProviderUser?.name ?? "Anchor / Spoke",
    status: dispatch.status,
    priceAtCreation: dispatch.priceAtCreation,
    failedReason: dispatch.errorMessage,
    createdAt: dispatch.createdAt,
    isExternal: true,
    externalDispatchId: dispatch.id,
    canCancelExternal:
      CANCELLABLE_EXTERNAL_STATUSES.has(dispatch.status) &&
      (!dispatch.spokeStopId || dispatch.spokeStopId.startsWith("unassignedStops/")),
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  // "Today" must be Vancouver's today — server-local midnight (UTC on Vercel)
  // rolls the dashboard to the next day at ~5 PM Pacific.
  const { dayStart: today, nextDayStart: tomorrow } = getVancouverDeliveryDateInfo();

  const [rawTodayOrders, todayExternalDispatches] = await Promise.all([
    prisma.order.findMany({
      where: {
        storeId: store.id,
        scheduledDate: { gte: today, lt: tomorrow },
      },
      include: { assignedDriver: true, deliveryZone: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.externalDispatch.findMany({
      where: {
        storeId: store.id,
        provider: "SPOKE",
        scheduledDate: { gte: today, lt: tomorrow },
        // Failed handoffs stay visible — hiding them makes the delivery look
        // "never entered" and invites a duplicate re-entry.
      },
      include: { selectedProviderUser: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const todayOrders = [
    ...dedupeRecurringDashboardOrders(rawTodayOrders).map(toDashboardDelivery),
    ...todayExternalDispatches.map(toExternalDashboardDelivery),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return <DashboardView storeSlug={store.slug} deliveries={todayOrders} />;
}
