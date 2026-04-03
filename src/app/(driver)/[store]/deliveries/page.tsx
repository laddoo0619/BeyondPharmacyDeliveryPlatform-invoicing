import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import DeliveryPoller from "./DeliveryPoller";
import DateNavigation from "./DateNavigation";
import DeliveryList from "./DeliveryList";

export default async function DeliveriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const session = await auth();
  if (!session?.user) return null;

  const sp = await searchParams;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let selectedDate: Date;
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) {
    const parsed = new Date(sp.date + "T00:00:00");
    selectedDate = isNaN(parsed.getTime()) ? new Date(today) : parsed;
  } else {
    selectedDate = new Date(today);
  }
  selectedDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const isToday = selectedDate.getTime() === today.getTime();

  const currentDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  // Fetch deliveries for selected date + any FAILED orders from previous days (only when viewing today)
  const [dateDeliveries, failedFromPreviousDays] = await Promise.all([
    prisma.order.findMany({
      where: {
        assignedDriverId: session.user.id,
        storeId: store.id,
        scheduledDate: { gte: selectedDate, lt: nextDay },
        status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED"] },
      },
      orderBy: { createdAt: "asc" },
    }),
    isToday
      ? prisma.order.findMany({
          where: {
            assignedDriverId: session.user.id,
            storeId: store.id,
            scheduledDate: { lt: today },
            status: "FAILED",
          },
          orderBy: { scheduledDate: "desc" },
        })
      : Promise.resolve([]),
  ]);

  // Combine: failed from previous days first, then selected date's
  const allDeliveries = [...failedFromPreviousDays, ...dateDeliveries];

  const pending = allDeliveries.filter(
    (d) => d.status !== "DELIVERED"
  );
  const completed = allDeliveries.filter((d) => d.status === "DELIVERED");
  const failed = allDeliveries.filter((d) => d.status === "FAILED");
  const eligibleForBatchDeliver = allDeliveries.filter(
    (d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)
  ).length;

  return (
    <div>
      <DeliveryPoller />
      <DateNavigation storeSlug={store.slug} currentDate={currentDateStr} />
      <h1 className="text-xl font-bold text-gray-900 mb-4">
        {isToday
          ? "Today\u2019s Deliveries"
          : `Deliveries for ${selectedDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`}
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        {pending.length} pending • {completed.length} completed
        {failed.length > 0 && (
          <span className="text-red-600"> • {failed.length} need re-attempt</span>
        )}
      </p>

      <DeliveryList
        deliveries={allDeliveries.map((d) => ({
          id: d.id,
          patientName: d.patientName,
          deliveryAddress: d.deliveryAddress,
          deliveryCity: d.deliveryCity,
          deliveryPostalCode: d.deliveryPostalCode,
          instructions: d.instructions,
          status: d.status,
          failedReason: d.failedReason,
          attemptCount: d.attemptCount,
          scheduledDate: d.scheduledDate.toISOString(),
          completedAt: d.completedAt ? d.completedAt.toISOString() : null,
        }))}
        storeSlug={store.slug}
        selectedDate={currentDateStr}
        isToday={isToday}
        eligibleForBatchDeliver={eligibleForBatchDeliver}
      />
    </div>
  );
}
