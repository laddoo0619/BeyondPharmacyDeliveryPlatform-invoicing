import cron from "node-cron";
import { del } from "@vercel/blob";
import { prisma } from "./db";
import { getPacificDayRange, getPacificDayOfWeek } from "./timezone";

let initialized = false;

export function initCronJobs() {
  if (initialized) return;
  initialized = true;

  // Run every day at 6:00 AM to generate orders from recurring templates
  cron.schedule("0 6 * * *", async () => {
    console.log("[CRON] Generating recurring orders...");
    await generateRecurringOrders();
  });

  // Run every day at 2:00 AM to purge old invoiced records (3-month retention)
  cron.schedule("0 2 * * *", async () => {
    console.log("[CRON] Running 3-month data cleanup...");
    await purgeOldInvoicedOrders();
  });

  // Run every day at 3:00 AM to delete POD images older than 7 days
  cron.schedule("0 3 * * *", async () => {
    console.log("[CRON] Running 7-day POD image cleanup...");
    await purgeExpiredPodImages();
  });

  console.log("[CRON] Recurring order scheduler initialized");
  console.log("[CRON] Data retention cleanup scheduler initialized");
  console.log("[CRON] POD image retention (7-day) scheduler initialized");
}

export async function generateRecurringOrders() {
  // Use Pacific Time for all day boundaries so cron running in UTC
  // generates orders for the correct Pacific Time day
  const dayOfWeek = getPacificDayOfWeek();
  const { start: todayStart, end: todayEnd } = getPacificDayRange();

  // Get start of current week (Sunday) in Pacific Time
  const startOfWeek = new Date(todayStart);
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  // Batch: auto-clear all expired holds in one query
  const clearedHolds = await prisma.recurringOrder.updateMany({
    where: { isOnHold: true, holdEnd: { lt: todayStart } },
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
      deliveryZone: true,
      store: true,
      skips: {
        where: {
          skipDate: { gte: startOfWeek, lt: endOfWeek },
        },
      },
    },
  });

  // Batch dedup: fetch all today's orders from recurring templates in one query
  const existingOrders = await prisma.order.findMany({
    where: {
      recurringOrderId: { not: null },
      scheduledDate: { gte: todayStart, lt: todayEnd },
    },
    select: { recurringOrderId: true },
  });
  const existingSet = new Set(existingOrders.map((o) => o.recurringOrderId));

  let created = 0;

  for (const recurring of recurringOrders) {
    // Parse activeDays and check if today is a delivery day
    const activeDays: number[] = JSON.parse(recurring.activeDays);
    if (!activeDays.includes(dayOfWeek)) continue;

    // Skip if there's a skip record for this week
    if (recurring.skips.length > 0) {
      console.log(`[CRON] Skipping recurring order for ${recurring.patientName} (skip record exists)`);
      continue;
    }

    // Batch dedup check (no per-order query)
    if (existingSet.has(recurring.id)) {
      console.log(`[CRON] Order already exists for ${recurring.patientName} today`);
      continue;
    }

    // Priority: recurring order's assigned driver > zone's default driver > PENDING
    const driverId = recurring.assignedDriverId || recurring.deliveryZone.defaultDriverId;
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
          scheduledDate: todayStart,
          recurringOrderId: recurring.id,
          createdById: recurring.createdById,
          storeId: recurring.storeId,
        },
      });
      created++;
      console.log(`[CRON] Created order for ${recurring.patientName} (${recurring.store.name}) — ${status}${driverId ? " (auto-assigned)" : ""}`);
    } catch (err) {
      // Race condition: another instance may have created this order
      console.warn(`[CRON] Skipped duplicate for ${recurring.patientName}:`, err);
    }
  }

  console.log(`[CRON] Generated ${created} recurring orders`);
  return created;
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
        await tx.proofOfDelivery.deleteMany({ where: { orderId: { in: batchIds } } });
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

const POD_BATCH_SIZE = 100;

export async function purgeExpiredPodImages() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let totalPurged = 0;

    while (true) {
      const batch = await prisma.proofOfDelivery.findMany({
        where: {
          deliveredAt: { lt: sevenDaysAgo },
          photoUrl: { not: null },
        },
        select: { id: true, photoUrl: true },
        take: POD_BATCH_SIZE,
      });

      if (batch.length === 0) break;

      // Delete blobs from Vercel Blob storage
      const urls = batch
        .map((p) => p.photoUrl)
        .filter((url): url is string => url !== null && url.startsWith("http"));

      if (urls.length > 0) {
        try {
          await del(urls);
        } catch (err) {
          console.warn("[CRON] Some blob deletions failed:", err);
        }
      }

      // Null out photoUrl in database so UI shows "Photo expired"
      const ids = batch.map((p) => p.id);
      await prisma.proofOfDelivery.updateMany({
        where: { id: { in: ids } },
        data: { photoUrl: null },
      });

      totalPurged += batch.length;
      console.log(`[CRON] Purged ${batch.length} expired POD images`);

      if (batch.length < POD_BATCH_SIZE) break;
    }

    if (totalPurged === 0) {
      console.log("[CRON] No expired POD images to purge");
    } else {
      console.log(`[CRON] Total purged: ${totalPurged} expired POD images`);
    }
    return totalPurged;
  } catch (error) {
    console.error("[CRON] POD image cleanup failed:", error);
    return 0;
  }
}
