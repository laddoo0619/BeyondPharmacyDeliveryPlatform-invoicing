import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildRecurringDuplicateCleanupPlan,
  formatRecurringDayList,
  recurringDuplicateSelect,
  type RecurringDuplicateCleanupChange,
  type RecurringDuplicateRecord,
} from "../src/lib/recurringDuplicateGuard";

const prisma = new PrismaClient();
const applyChanges = process.argv.includes("--apply");

function getVancouverDayStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: string) =>
    parts.find((current) => current.type === type)?.value ?? "";
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
}

function describeChange(change: RecurringDuplicateCleanupChange) {
  const duplicateDays = formatRecurringDayList(change.duplicateDays);
  const action =
    change.remainingDays.length > 0
      ? `prune to ${formatRecurringDayList(change.remainingDays)}`
      : "deactivate";
  const keptBy = change.keptBy
    .map(
      (keeper) =>
        `${formatRecurringDayList([keeper.day])}: ${keeper.patientName} (${keeper.recurringOrderId})`
    )
    .join("; ");

  return [
    `${change.order.patientName} (${change.order.id})`,
    `duplicate days: ${duplicateDays}`,
    `action: ${action}`,
    `kept by: ${keptBy}`,
  ].join(" | ");
}

async function loadActiveRecurringOrders(
  client: PrismaClient | Prisma.TransactionClient
) {
  return (await client.recurringOrder.findMany({
    where: { isActive: true },
    select: recurringDuplicateSelect,
    orderBy: [{ storeId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  })) as RecurringDuplicateRecord[];
}

async function cancelFutureGeneratedOrders(
  tx: Prisma.TransactionClient,
  change: RecurringDuplicateCleanupChange,
  todayStart: Date
) {
  const duplicateDays = new Set(change.duplicateDays);
  const futureOrders = await tx.order.findMany({
    where: {
      recurringOrderId: change.order.id,
      scheduledDate: { gte: todayStart },
      status: { in: ["PENDING", "ASSIGNED"] },
    },
    select: { id: true, scheduledDate: true },
  });
  const orderIds = futureOrders
    .filter((order) => duplicateDays.has(order.scheduledDate.getUTCDay()))
    .map((order) => order.id);

  if (orderIds.length === 0) return 0;

  const cancelled = await tx.order.updateMany({
    where: { id: { in: orderIds } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  return cancelled.count;
}

async function applyCleanup() {
  const todayStart = getVancouverDayStart();

  return prisma.$transaction(async (tx) => {
    const activeRecurringOrders = await loadActiveRecurringOrders(tx);
    const plan = buildRecurringDuplicateCleanupPlan(activeRecurringOrders);
    let cancelledOrders = 0;

    for (const change of plan) {
      if (change.remainingDays.length > 0) {
        await tx.recurringOrder.update({
          where: { id: change.order.id },
          data: { activeDays: JSON.stringify(change.remainingDays) },
        });
      } else {
        await tx.recurringOrder.update({
          where: { id: change.order.id },
          data: { isActive: false },
        });
      }

      cancelledOrders += await cancelFutureGeneratedOrders(tx, change, todayStart);
    }

    return { changes: plan, cancelledOrders };
  });
}

async function main() {
  if (applyChanges) {
    const result = await applyCleanup();
    console.log(`Applied ${result.changes.length} recurring duplicate cleanup change(s).`);
    console.log(`Cancelled ${result.cancelledOrders} future duplicate generated order(s).`);
    for (const change of result.changes) {
      console.log(`- ${describeChange(change)}`);
    }
    return;
  }

  const activeRecurringOrders = await loadActiveRecurringOrders(prisma);
  const plan = buildRecurringDuplicateCleanupPlan(activeRecurringOrders);
  console.log(`Found ${plan.length} recurring duplicate cleanup change(s).`);
  if (plan.length === 0) return;

  for (const change of plan) {
    console.log(`- ${describeChange(change)}`);
  }
  console.log("\nDry run only. Re-run with --apply to make these changes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
