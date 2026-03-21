import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import RecurringOrderForm from "./RecurringOrderForm";
import RecurringOrderList from "./RecurringOrderList";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const [recurringOrders, zones, drivers] = await Promise.all([
    prisma.recurringOrder.findMany({
      where: { storeId: store.id },
      include: {
        deliveryZone: true,
        assignedDriver: { select: { id: true, name: true } },
        skips: {
          where: {
            skipDate: {
              gte: getStartOfWeek(),
              lt: getEndOfWeek(),
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deliveryZone.findMany({
      where: { isActive: true, storeId: store.id },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "DRIVER", isActive: true, storeId: store.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recurring Deliveries</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RecurringOrderForm
            storeSlug={storeSlug}
            zones={zones.map((z) => ({ id: z.id, name: z.name, price: z.price }))}
            drivers={drivers}
          />
        </div>
        <div className="lg:col-span-2">
          <RecurringOrderList
            storeSlug={storeSlug}
            drivers={drivers}
            orders={recurringOrders.map((o) => ({
              id: o.id,
              patientName: o.patientName,
              deliveryAddress: o.deliveryAddress,
              deliveryCity: o.deliveryCity,
              zoneName: o.deliveryZone.name,
              zonePrice: o.deliveryZone.price,
              activeDays: JSON.parse(o.activeDays) as number[],
              isActive: o.isActive,
              isOnHold: o.isOnHold,
              holdStart: o.holdStart?.toISOString() ?? null,
              holdEnd: o.holdEnd?.toISOString() ?? null,
              isSkippedThisWeek: o.skips.length > 0,
              assignedDriverId: o.assignedDriverId,
              assignedDriverName: o.assignedDriver?.name ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek() {
  const d = getStartOfWeek();
  d.setDate(d.getDate() + 7);
  return d;
}
