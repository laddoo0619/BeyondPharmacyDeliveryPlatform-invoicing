import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import ZoneForm from "./ZoneForm";
import ZoneList from "./ZoneList";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const zones = await prisma.deliveryZone.findMany({
    where: { storeId: store.id },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Delivery Zone Pricing</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ZoneForm storeSlug={storeSlug} />
        </div>
        <div className="lg:col-span-2">
          <ZoneList storeSlug={storeSlug} zones={zones} />
        </div>
      </div>
    </div>
  );
}
