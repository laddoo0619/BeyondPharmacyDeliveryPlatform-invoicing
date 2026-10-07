import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import PricingView from "./PricingView";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const [zones, drivers] = await Promise.all([
    prisma.deliveryZone.findMany({
      where: { storeId: store.id },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { storeId: store.id, role: "DRIVER", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <PricingView
      storeSlug={storeSlug}
      zones={zones}
      drivers={drivers}
    />
  );
}
