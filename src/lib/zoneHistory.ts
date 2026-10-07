import { prisma } from "./db";
import {
  buildZoneHistory,
  pickFallbackZoneId,
  type SuggestableZone,
  type ZoneHistory,
} from "./zoneSuggestion";

export interface ZoneSuggestionData {
  history: ZoneHistory;
  fallbackZoneId: string | null;
}

/**
 * How this store has priced deliveries to each city, from its in-house orders
 * — the deliveries whose zone sets Derek's pay. Anchor (Spoke) deliveries are
 * deliberately excluded: their zone never affected money, so staff picked it
 * loosely and it would skew the suggestions.
 */
export async function getZoneSuggestionData(
  storeId: string,
  activeZones: SuggestableZone[]
): Promise<ZoneSuggestionData> {
  const rows = await prisma.order.groupBy({
    by: ["deliveryCity", "deliveryZoneId"],
    where: { storeId, status: { not: "CANCELLED" } },
    _count: { _all: true },
    _max: { scheduledDate: true },
  });

  const history = buildZoneHistory(
    rows.map((row) => ({
      city: row.deliveryCity,
      zoneId: row.deliveryZoneId,
      count: row._count._all,
      lastUsed: row._max.scheduledDate,
    }))
  );

  return { history, fallbackZoneId: pickFallbackZoneId(activeZones, history) };
}
