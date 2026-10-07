import { prisma } from "./db";
import { getSpokeProviderUserIds } from "./spoke";
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
 * — the deliveries whose zone sets Derek's pay. Anchor deliveries are left out
 * twice over: Spoke dispatches live in another table, and in-house Orders that
 * were assigned to the Anchor account (before the Spoke integration, March–June
 * 2026: 931 rows) are excluded here — Anchor's billing isn't Derek's.
 */
export async function getZoneSuggestionData(
  storeId: string,
  activeZones: SuggestableZone[]
): Promise<ZoneSuggestionData> {
  const spokeProviderIds = [...getSpokeProviderUserIds()];
  const rows = await prisma.order.groupBy({
    by: ["deliveryCity", "deliveryZoneId"],
    where: {
      storeId,
      status: { not: "CANCELLED" },
      // `notIn` alone would also drop unassigned orders (NULL never matches).
      ...(spokeProviderIds.length > 0
        ? {
            OR: [
              { assignedDriverId: null },
              { assignedDriverId: { notIn: spokeProviderIds } },
            ],
          }
        : {}),
    },
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
