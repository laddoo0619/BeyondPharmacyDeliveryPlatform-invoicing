import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import NewOrderView from "./NewOrderView";
import { isSelectedSpokeProvider } from "@/lib/spokeDispatch";
import { getZoneSuggestionData } from "@/lib/zoneHistory";
import { deliveryDateDefault } from "@/lib/vancouverDate";

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

  const zoneOptions = zones.map((z) => ({
    id: z.id,
    name: z.name,
    price: z.price,
    defaultDriverId: z.defaultDriverId,
  }));
  const { history, fallbackZoneId } = await getZoneSuggestionData(store.id, zoneOptions);

  return (
    <NewOrderView
      storeSlug={storeSlug}
      zones={zoneOptions}
      drivers={drivers.map((d) => ({
        id: d.id,
        name: d.name,
        // Anchor (Spoke) deliveries don't use the zone price, so the form
        // hides the zone selector for them.
        isExternal: isSelectedSpokeProvider(d.id),
      }))}
      zoneHistory={history}
      fallbackZoneId={fallbackZoneId}
      // Today before 12 PM Vancouver time, tomorrow from noon.
      dateDefault={deliveryDateDefault()}
    />
  );
}
