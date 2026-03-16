import { prisma } from "@/lib/db";
import RecurringOrderForm from "./RecurringOrderForm";
import RecurringOrderList from "./RecurringOrderList";

export default async function RecurringPage() {
  const [recurringOrders, zones] = await Promise.all([
    prisma.recurringOrder.findMany({
      include: {
        deliveryZone: true,
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
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Recurring Deliveries
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <RecurringOrderForm
            zones={zones.map((z) => ({ id: z.id, name: z.name, price: z.price }))}
          />
        </div>
        <div className="lg:col-span-2">
          <RecurringOrderList
            orders={recurringOrders.map((o) => ({
              id: o.id,
              patientName: o.patientName,
              deliveryAddress: o.deliveryAddress,
              deliveryCity: o.deliveryCity,
              zoneName: o.deliveryZone.name,
              zonePrice: o.deliveryZone.price,
              dayOfWeek: o.dayOfWeek,
              isActive: o.isActive,
              isSkippedThisWeek: o.skips.length > 0,
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
