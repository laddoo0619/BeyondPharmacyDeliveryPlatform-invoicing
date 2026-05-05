import cron from "node-cron";
import { prisma } from "./db";

const DELIVERY_TIME_ZONE = "America/Vancouver";
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

let initialized = false;

export function initCronJobs() {
  if (initialized) return;
  initialized = true;

  if (process.env.VERCEL === "1") {
    console.log(
      "[CRON] Skipping in-process recurring order scheduler on Vercel; Vercel Cron handles it."
    );
  } else {
    // Run every day at 6:00 AM to generate orders from recurring templates
    cron.schedule("0 6 * * *", async () => {
      console.log("[CRON] Generating recurring orders...");
      await generateRecurringOrders();
    });
  }

  // Run every day at 2:00 AM to purge old invoiced records (3-month retention)
  cron.schedule("0 2 * * *", async () => {
    console.log("[CRON] Running 3-month data cleanup...");
    await purgeOldInvoicedOrders();
  });

  console.log("[CRON] Recurring order scheduler initialized");
  console.log("[CRON] Data retention cleanup scheduler initialized");
}

interface DeliveryDateInfo {
  dateKey: string;
  dayOfWeek: number;
  dayStart: Date;
  nextDayStart: Date;
  weekStart: Date;
  weekEnd: Date;
}

interface DriverCandidate {
  id: string;
  role: string;
  isActive: boolean;
  storeId: string | null;
}

interface RecurrenceSchedule {
  recurrenceIntervalWeeks: number;
  recurrenceAnchorDate: Date;
}

export interface RecurringGenerationResult {
  dateKey: string;
  total: number;
  due: number;
  created: number;
  existing: number;
  skipped: number;
}

export function getVancouverDeliveryDateInfo(now = new Date()): DeliveryDateInfo {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const dateKey = `${part("year")}-${part("month")}-${part("day")}`;
  const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
  const nextDayStart = new Date(dayStart);
  nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[part("weekday")] ?? dayStart.getUTCDay();

  const weekStart = new Date(dayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  return { dateKey, dayOfWeek, dayStart, nextDayStart, weekStart, weekEnd };
}

export function isVancouverSixAmWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);

  return parts.find((p) => p.type === "hour")?.value === "06";
}

export function formatGenerationMessage(result: RecurringGenerationResult) {
  if (result.created > 0) {
    return `${result.created} order${result.created === 1 ? "" : "s"} generated for today.`;
  }

  if (result.existing > 0) {
    return "Today's recurring orders have already been generated.";
  }

  return "No recurring orders are due today.";
}

function parseActiveDays(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
    ) {
      return parsed as number[];
    }
  } catch {
    // Invalid JSON is handled by skipping the affected recurring order.
  }

  return null;
}

function validDriverId(driver: DriverCandidate | null | undefined, storeId: string) {
  if (!driver) return null;
  if (driver.role !== "DRIVER" || !driver.isActive || driver.storeId !== storeId) {
    return null;
  }
  return driver.id;
}

function utcWeekStart(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

export function isRecurringScheduleDue(
  recurring: RecurrenceSchedule,
  deliveryDate: Pick<DeliveryDateInfo, "weekStart">
) {
  const interval = recurring.recurrenceIntervalWeeks;
  if (interval <= 1) return true;

  const anchorWeekStart = utcWeekStart(recurring.recurrenceAnchorDate);
  const weeksSinceAnchor = Math.floor(
    (deliveryDate.weekStart.getTime() - anchorWeekStart.getTime()) / MS_PER_WEEK
  );

  return weeksSinceAnchor >= 0 && weeksSinceAnchor % interval === 0;
}

export async function generateRecurringOrders(now = new Date()): Promise<RecurringGenerationResult> {
  const deliveryDate = getVancouverDeliveryDateInfo(now);

  // Batch: auto-clear all expired holds in one query
  const clearedHolds = await prisma.recurringOrder.updateMany({
    where: { isOnHold: true, holdEnd: { lt: deliveryDate.dayStart } },
    data: { isOnHold: false, holdStart: null, holdEnd: null },
  });
  if (clearedHolds.count > 0) {
    console.log(`[CRON] Auto-cleared ${clearedHolds.count} expired vacation holds`);
  }

  // Find active recurring orders that are not currently on hold
  const recurringOrders = await prisma.recurringOrder.findMany({
    where: {
      isActive: true,
      isOnHold: false,
    },
    include: {
      assignedDriver: {
        select: { id: true, role: true, isActive: true, storeId: true },
      },
      deliveryZone: {
        include: {
          defaultDriver: {
            select: { id: true, role: true, isActive: true, storeId: true },
          },
        },
      },
      store: true,
      skips: {
        where: {
          skipDate: { gte: deliveryDate.weekStart, lt: deliveryDate.weekEnd },
        },
      },
    },
  });

  // Batch dedup: fetch all today's orders from recurring templates in one query
  const existingOrders = await prisma.order.findMany({
    where: {
      recurringOrderId: { not: null },
      scheduledDate: { gte: deliveryDate.dayStart, lt: deliveryDate.nextDayStart },
    },
    select: { recurringOrderId: true },
  });
  const existingSet = new Set(existingOrders.map((o) => o.recurringOrderId));

  let created = 0;
  let due = 0;
  let existing = 0;
  let skipped = 0;

  for (const recurring of recurringOrders) {
    // Parse activeDays and check if today is a delivery day
    const activeDays = parseActiveDays(recurring.activeDays);
    if (!activeDays) {
      console.warn(`[CRON] Skipping recurring order for ${recurring.patientName} (invalid activeDays)`);
      skipped++;
      continue;
    }
    if (!activeDays.includes(deliveryDate.dayOfWeek)) continue;
    if (!isRecurringScheduleDue(recurring, deliveryDate)) continue;

    due++;

    // Skip if there's a skip record for this week
    if (recurring.skips.length > 0) {
      console.log(`[CRON] Skipping recurring order for ${recurring.patientName} (skip record exists)`);
      skipped++;
      continue;
    }

    // Batch dedup check (no per-order query)
    if (existingSet.has(recurring.id)) {
      console.log(`[CRON] Order already exists for ${recurring.patientName} today`);
      existing++;
      continue;
    }

    // Priority: recurring order's assigned driver > zone's default driver > PENDING
    const driverId =
      validDriverId(recurring.assignedDriver, recurring.storeId) ??
      validDriverId(recurring.deliveryZone.defaultDriver, recurring.storeId);
    const status = driverId ? "ASSIGNED" : "PENDING";

    // Create the order — catch unique constraint errors for race condition safety
    try {
      await prisma.order.create({
        data: {
          patientName: recurring.patientName,
          patientPhone: recurring.patientPhone,
          deliveryAddress: recurring.deliveryAddress,
          deliveryCity: recurring.deliveryCity,
          deliveryPostalCode: recurring.deliveryPostalCode,
          deliveryZoneId: recurring.deliveryZoneId,
          deliveryZoneName: recurring.deliveryZone.name,
          priceAtCreation: recurring.deliveryZone.price,
          instructions: recurring.instructions,
          status,
          assignedDriverId: driverId,
          scheduledDate: deliveryDate.dayStart,
          recurringOrderId: recurring.id,
          createdById: recurring.createdById,
          storeId: recurring.storeId,
        },
      });
      existingSet.add(recurring.id);
      created++;
      console.log(`[CRON] Created order for ${recurring.patientName} (${recurring.store.name}) — ${status}${driverId ? " (auto-assigned)" : ""}`);
    } catch (err) {
      // Race condition: another instance may have created this order
      console.warn(`[CRON] Skipped duplicate for ${recurring.patientName}:`, err);
      existing++;
    }
  }

  console.log(`[CRON] Generated ${created} recurring orders for ${deliveryDate.dateKey}`);
  return {
    dateKey: deliveryDate.dateKey,
    total: recurringOrders.length,
    due,
    created,
    existing,
    skipped,
  };
}

const PURGE_BATCH_SIZE = 500;

export async function purgeOldInvoicedOrders() {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    let totalPurged = 0;

    // Process in batches to avoid memory/timeout issues on large datasets
    while (true) {
      const batch = await prisma.order.findMany({
        where: {
          isInvoiced: true,
          completedAt: { not: null, lt: threeMonthsAgo },
          status: { in: ["DELIVERED", "FAILED", "CANCELLED"] },
        },
        select: { id: true },
        take: PURGE_BATCH_SIZE,
      });

      if (batch.length === 0) break;

      const batchIds = batch.map((o) => o.id);

      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { orderId: { in: batchIds } } });
        await tx.invoiceLineItem.deleteMany({ where: { orderId: { in: batchIds } } });
        await tx.order.deleteMany({ where: { id: { in: batchIds } } });
      });

      totalPurged += batch.length;
      console.log(`[CRON] Purged batch of ${batch.length} old invoiced orders`);

      if (batch.length < PURGE_BATCH_SIZE) break;
    }

    if (totalPurged === 0) {
      console.log("[CRON] No old invoiced orders to purge");
    } else {
      console.log(`[CRON] Total purged: ${totalPurged} old invoiced orders`);
    }
    return totalPurged;
  } catch (error) {
    console.error("[CRON] Data cleanup failed:", error);
    return 0;
  }
}
