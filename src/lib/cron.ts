import cron from "node-cron";
import { prisma } from "./db";

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

  console.log("[CRON] Recurring order scheduler initialized");
  console.log("[CRON] Data retention cleanup scheduler initialized");
}

export async function generateRecurringOrders() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun..6=Sat

  // Get start of current week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  // Find active recurring orders that are not currently on hold
  const recurringOrders = await prisma.recurringOrder.findMany({
    where: {
      isActive: true,
      OR: [
        { isOnHold: false },
        { holdEnd: { lt: today } }, // Hold has expired
      ],
    },
    include: {
      deliveryZone: true,
      store: true,
      skips: {
        where: {
          skipDate: {
            gte: startOfWeek,
            lt: endOfWeek,
          },
        },
      },
    },
  });

  let created = 0;

  for (const recurring of recurringOrders) {
    // Parse activeDays and check if today is a delivery day
    const activeDays: number[] = JSON.parse(recurring.activeDays);
    if (!activeDays.includes(dayOfWeek)) {
      continue;
    }

    // Double-check vacation hold date range
    if (recurring.isOnHold && recurring.holdStart && recurring.holdEnd) {
      if (today >= recurring.holdStart && today <= recurring.holdEnd) {
        console.log(
          `[CRON] Skipping recurring order for ${recurring.patientName} (on vacation hold)`
        );
        continue;
      }
    }

    // Auto-clear expired holds
    if (recurring.isOnHold && recurring.holdEnd && today > recurring.holdEnd) {
      await prisma.recurringOrder.update({
        where: { id: recurring.id },
        data: { isOnHold: false, holdStart: null, holdEnd: null },
      });
      console.log(
        `[CRON] Auto-cleared expired vacation hold for ${recurring.patientName}`
      );
    }

    // Skip if there's a skip record for this week
    if (recurring.skips.length > 0) {
      console.log(
        `[CRON] Skipping recurring order for ${recurring.patientName} (skip record exists)`
      );
      continue;
    }

    // Check if an order already exists for this recurring order today
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const existingOrder = await prisma.order.findFirst({
      where: {
        recurringOrderId: recurring.id,
        scheduledDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    if (existingOrder) {
      console.log(
        `[CRON] Order already exists for ${recurring.patientName} today`
      );
      continue;
    }

    // Auto-assign driver from zone's default driver, or leave PENDING
    const defaultDriverId = recurring.deliveryZone.defaultDriverId;
    const status = defaultDriverId ? "ASSIGNED" : "PENDING";

    // Create the order with price snapshot and storeId
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
        assignedDriverId: defaultDriverId,
        scheduledDate: new Date(),
        recurringOrderId: recurring.id,
        createdById: recurring.createdById,
        storeId: recurring.storeId,
      },
    });

    created++;
    console.log(`[CRON] Created order for ${recurring.patientName} (${recurring.store.name}) — ${status}${defaultDriverId ? " (auto-assigned)" : ""}`);
  }

  console.log(`[CRON] Generated ${created} recurring orders`);
  return created;
}

export async function purgeOldInvoicedOrders() {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Find invoiced orders completed more than 3 months ago
    const orders = await prisma.order.findMany({
      where: {
        isInvoiced: true,
        completedAt: { not: null, lt: threeMonthsAgo },
        status: { in: ["DELIVERED", "FAILED", "CANCELLED"] },
      },
      select: { id: true, storeId: true },
    });

    if (orders.length === 0) {
      console.log("[CRON] No old invoiced orders to purge");
      return 0;
    }

    const orderIds = orders.map((o) => o.id);

    // Cascade delete related records, then the orders
    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.invoiceLineItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.proofOfDelivery.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    });

    console.log(`[CRON] Purged ${orders.length} old invoiced orders`);
    return orders.length;
  } catch (error) {
    console.error("[CRON] Data cleanup failed:", error);
    return 0;
  }
}
