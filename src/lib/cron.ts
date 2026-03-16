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

  console.log("[CRON] Recurring order scheduler initialized");
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

  // Find active recurring orders for today's day of week (across all stores)
  const recurringOrders = await prisma.recurringOrder.findMany({
    where: {
      isActive: true,
      dayOfWeek,
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
        status: "PENDING",
        scheduledDate: new Date(),
        recurringOrderId: recurring.id,
        createdById: recurring.createdById,
        storeId: recurring.storeId,
      },
    });

    created++;
    console.log(`[CRON] Created order for ${recurring.patientName} (${recurring.store.name})`);
  }

  console.log(`[CRON] Generated ${created} recurring orders`);
  return created;
}
