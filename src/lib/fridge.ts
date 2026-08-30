import { prisma } from "./db";
import { getVancouverDeliveryDateInfo } from "./cron";

// A delivery is either an in-house Order or an Anchor/Spoke ExternalDispatch —
// never both — so the checklist is the union of the two tables.
export type FridgeDeliveryKind = "ORDER" | "DISPATCH";

export interface FridgeChecklistItem {
  id: string;
  kind: FridgeDeliveryKind;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  fridgeItemNote: string | null;
  checkedAt: string | null;
  isExternal: boolean;
}

export interface FridgeChecklist {
  dateKey: string;
  items: FridgeChecklistItem[];
  outstanding: number;
}

// Expressed as "everything except settled" rather than a list of open statuses:
// enumerating the open ones silently dropped PICKED_UP (set by the driver while
// loading the van — exactly when the fridge item still has to go in the bag),
// because the Order.status schema comment omits it. Settled deliveries are
// excluded so the popup can't stay open on a row nobody can action.
export const SETTLED_ORDER_STATUSES = ["DELIVERED", "FAILED", "CANCELLED"];
export const SETTLED_DISPATCH_STATUSES = [
  "DELIVERED",
  "DELIVERY_FAILED",
  "DISPATCH_FAILED",
  "CANCELLED",
];

export async function getFridgeChecklist(
  storeId: string,
  now = new Date()
): Promise<FridgeChecklist> {
  const { dateKey, dayStart, nextDayStart } = getVancouverDeliveryDateInfo(now);
  const scheduledDate = { gte: dayStart, lt: nextDayStart };

  const [orders, dispatches] = await Promise.all([
    prisma.order.findMany({
      where: {
        storeId,
        scheduledDate,
        hasFridgeItem: true,
        status: { notIn: SETTLED_ORDER_STATUSES },
      },
      select: {
        id: true,
        patientName: true,
        deliveryAddress: true,
        deliveryCity: true,
        fridgeItemNote: true,
        fridgeCheckedAt: true,
      },
    }),
    prisma.externalDispatch.findMany({
      where: {
        storeId,
        scheduledDate,
        hasFridgeItem: true,
        status: { notIn: SETTLED_DISPATCH_STATUSES },
      },
      select: {
        id: true,
        patientName: true,
        deliveryAddress: true,
        deliveryCity: true,
        fridgeItemNote: true,
        fridgeCheckedAt: true,
      },
    }),
  ]);

  const items: FridgeChecklistItem[] = [
    ...orders.map((order) => ({
      ...order,
      kind: "ORDER" as const,
      isExternal: false,
    })),
    ...dispatches.map((dispatch) => ({
      ...dispatch,
      kind: "DISPATCH" as const,
      isExternal: true,
    })),
  ]
    .map(({ fridgeCheckedAt, ...rest }) => ({
      ...rest,
      checkedAt: fridgeCheckedAt ? fridgeCheckedAt.toISOString() : null,
    }))
    // Outstanding items first — the whole point of the reminder — then by
    // name so the list reads in a stable order as items are ticked off.
    .sort((a, b) => {
      if (!a.checkedAt !== !b.checkedAt) return a.checkedAt ? 1 : -1;
      return a.patientName.localeCompare(b.patientName);
    });

  return {
    dateKey,
    items,
    outstanding: items.filter((item) => !item.checkedAt).length,
  };
}
