import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import NewOrderForm from "./NewOrderForm";
import { pageTitle } from "@/lib/portalStyles";

export default async function NewOrderPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const [zones, drivers] = await Promise.all([
    prisma.deliveryZone.findMany({
      where: { isActive: true, storeId: store.id },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "DRIVER", isActive: true, storeId: store.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className={`${pageTitle} mb-6`}>
        Create New <span className="italic font-semibold">Order</span>
      </h1>
      <NewOrderForm
        storeSlug={storeSlug}
        zones={zones.map((z) => ({ id: z.id, name: z.name, price: z.price, defaultDriverId: z.defaultDriverId }))}
        drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
