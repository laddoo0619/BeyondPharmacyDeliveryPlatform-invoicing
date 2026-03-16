import { prisma } from "@/lib/db";
import NewOrderForm from "./NewOrderForm";

export default async function NewOrderPage() {
  const zones = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create New Order
      </h1>
      <NewOrderForm
        zones={zones.map((z) => ({
          id: z.id,
          name: z.name,
          price: z.price,
        }))}
      />
    </div>
  );
}
