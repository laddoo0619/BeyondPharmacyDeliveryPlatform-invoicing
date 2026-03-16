import { prisma } from "@/lib/db";
import ZoneForm from "./ZoneForm";
import ZoneList from "./ZoneList";

export default async function PricingPage() {
  const zones = await prisma.deliveryZone.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Delivery Zone Pricing
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ZoneForm />
        </div>
        <div className="lg:col-span-2">
          <ZoneList zones={zones} />
        </div>
      </div>
    </div>
  );
}
