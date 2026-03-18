/**
 * AWS Lambda handler for generating daily recurring orders.
 *
 * Deployment:
 * 1. Bundle this file with its dependencies (prisma client, @prisma/client)
 * 2. Create a Lambda function with Node.js 20.x runtime
 * 3. Set environment variable DATABASE_URL to your PostgreSQL connection string
 * 4. Create an EventBridge rule with cron expression: cron(0 6 * * ? *)
 *    (runs daily at 6:00 AM UTC — adjust for your timezone)
 * 5. Set the EventBridge rule target to this Lambda function
 *
 * Required IAM permissions:
 * - Lambda basic execution role (CloudWatch Logs)
 * - VPC access if your database is in a private subnet
 *
 * The logic mirrors src/lib/cron.ts generateRecurringOrders() exactly.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function handler() {
  console.log("[LAMBDA] Generating recurring orders...");

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
        { holdEnd: { lt: today } },
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
  let skipped = 0;

  for (const recurring of recurringOrders) {
    // Parse activeDays and check if today is a delivery day
    const activeDays: number[] = JSON.parse(recurring.activeDays);
    if (!activeDays.includes(dayOfWeek)) {
      continue;
    }

    // Double-check vacation hold date range
    if (recurring.isOnHold && recurring.holdStart && recurring.holdEnd) {
      if (today >= recurring.holdStart && today <= recurring.holdEnd) {
        console.log(`[LAMBDA] Skipping ${recurring.patientName} (on vacation hold)`);
        skipped++;
        continue;
      }
    }

    // Auto-clear expired holds
    if (recurring.isOnHold && recurring.holdEnd && today > recurring.holdEnd) {
      await prisma.recurringOrder.update({
        where: { id: recurring.id },
        data: { isOnHold: false, holdStart: null, holdEnd: null },
      });
      console.log(`[LAMBDA] Auto-cleared expired hold for ${recurring.patientName}`);
    }

    // Skip if there's a skip record for this week
    if (recurring.skips.length > 0) {
      console.log(`[LAMBDA] Skipping ${recurring.patientName} (skip record exists)`);
      skipped++;
      continue;
    }

    // Check if an order already exists for today (idempotency guard)
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const existingOrder = await prisma.order.findFirst({
      where: {
        recurringOrderId: recurring.id,
        scheduledDate: { gte: todayStart, lt: todayEnd },
      },
    });

    if (existingOrder) {
      console.log(`[LAMBDA] Order already exists for ${recurring.patientName} today`);
      continue;
    }

    // Auto-assign driver from zone's default driver, or leave PENDING
    const defaultDriverId = recurring.deliveryZone.defaultDriverId;
    const status = defaultDriverId ? "ASSIGNED" : "PENDING";

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
    console.log(`[LAMBDA] Created order for ${recurring.patientName} (${recurring.store.name}) — ${status}`);
  }

  await prisma.$disconnect();

  const result = {
    statusCode: 200,
    body: { created, skipped, total: recurringOrders.length },
  };

  console.log(`[LAMBDA] Done: ${created} orders created, ${skipped} skipped`);
  return result;
}
