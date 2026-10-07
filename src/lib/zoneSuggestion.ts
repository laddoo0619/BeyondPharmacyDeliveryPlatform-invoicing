// Suggests a delivery zone from the delivery address's city. Pure and
// client-safe, so the order forms can fill the zone in as staff type.
//
// The order of evidence matters for Derek's pay (in-house invoices are priced
// from the zone):
//   1. how this store has actually priced deliveries to that city before
//      (plurality of past in-house orders), then
//   2. a zone whose name IS the city ("Richmond" -> Richmond).
// Never a prefix/partial match: "Langley Township" deliveries are billed at
// the $4.25 Langley rate in practice, and a prefix match would pick the $10
// "Langley Township/Aldergrove" zone instead.

export interface SuggestableZone {
  id: string;
  name: string;
}

export interface ZoneHistoryEntry {
  zoneId: string;
  count: number;
  // ISO timestamp of the most recent delivery priced this way; breaks ties.
  lastUsed: string | null;
}

// Normalized city key -> zones previously used for deliveries to that city.
export type ZoneHistory = Record<string, ZoneHistoryEntry[]>;

export interface ZoneSuggestion {
  zoneId: string;
  source: "history" | "name";
  // Past deliveries backing a history suggestion (0 for a name match).
  count: number;
}

// Case-, accent-, punctuation- and space-insensitive, so "White Rock",
// "whiterock" and the stored zone name "White rock" all line up, and trailing
// spaces in zone names ("abbotsford ") don't matter.
export function normalizeCityKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function buildZoneHistory(
  rows: Array<{
    city: string | null;
    zoneId: string | null;
    count: number;
    lastUsed: Date | string | null;
  }>
): ZoneHistory {
  const history: ZoneHistory = {};

  for (const row of rows) {
    const key = normalizeCityKey(row.city);
    if (!key || !row.zoneId || row.count <= 0) continue;

    const lastUsed =
      row.lastUsed instanceof Date ? row.lastUsed.toISOString() : row.lastUsed ?? null;
    const entries = (history[key] ??= []);
    const existing = entries.find((entry) => entry.zoneId === row.zoneId);

    if (existing) {
      existing.count += row.count;
      if (lastUsed && (!existing.lastUsed || lastUsed > existing.lastUsed)) {
        existing.lastUsed = lastUsed;
      }
    } else {
      entries.push({ zoneId: row.zoneId, count: row.count, lastUsed });
    }
  }

  return history;
}

function byCountThenRecency(a: ZoneHistoryEntry, b: ZoneHistoryEntry) {
  if (b.count !== a.count) return b.count - a.count;
  return (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "");
}

export function suggestZone(input: {
  city: string | null | undefined;
  zones: SuggestableZone[];
  history: ZoneHistory;
}): ZoneSuggestion | null {
  const key = normalizeCityKey(input.city);
  if (!key) return null;

  // Only zones staff can currently pick (the forms load active zones), so a
  // retired zone with a long history is never suggested.
  const offered = new Set(input.zones.map((zone) => zone.id));
  const past = (input.history[key] ?? []).filter((entry) => offered.has(entry.zoneId));
  if (past.length > 0) {
    const best = [...past].sort(byCountThenRecency)[0];
    return { zoneId: best.zoneId, source: "history", count: best.count };
  }

  const named = input.zones.find((zone) => normalizeCityKey(zone.name) === key);
  return named ? { zoneId: named.id, source: "name", count: 0 } : null;
}

/**
 * The zone used when nothing matches and the zone doesn't affect money —
 * Anchor deliveries, whose price is never invoiced. The store's most-used
 * zone overall, else the first zone alphabetically.
 */
export function pickFallbackZoneId(zones: SuggestableZone[], history: ZoneHistory) {
  if (zones.length === 0) return null;

  const offered = new Set(zones.map((zone) => zone.id));
  const totals = new Map<string, number>();
  for (const entries of Object.values(history)) {
    for (const entry of entries) {
      if (offered.has(entry.zoneId)) {
        totals.set(entry.zoneId, (totals.get(entry.zoneId) ?? 0) + entry.count);
      }
    }
  }

  const byName = [...zones].sort((a, b) => a.name.trim().localeCompare(b.name.trim()));
  let best = byName[0];
  for (const zone of byName) {
    if ((totals.get(zone.id) ?? 0) > (totals.get(best.id) ?? 0)) best = zone;
  }
  return best.id;
}

// Hint shown under a pre-filled zone, so staff know where it came from.
export function describeZoneSuggestion(
  suggestion: ZoneSuggestion,
  city: string,
  zoneName: string
) {
  const place = city.trim();
  return suggestion.source === "history"
    ? `Suggested from ${suggestion.count} past deliver${suggestion.count === 1 ? "y" : "ies"} to ${place} — check before saving`
    : `Matched to the ${zoneName.trim()} zone by city — check before saving`;
}

export interface ZoneSelection {
  // The zone the form submits (and, for in-house drivers, shows).
  selectedZoneId: string;
  // False only for Anchor when a zone could be worked out — Anchor prices are
  // never invoiced, so staff don't need to see or confirm the zone.
  showZoneSelect: boolean;
}

/**
 * Which zone a delivery form uses.
 * - manualZoneId: null = follow the suggestion; "" = staff cleared it; an id =
 *   staff picked it. A manual pick is never overwritten.
 * - Anchor: manual pick, else suggestion, else the store's fallback zone.
 * - In-house: manual pick (even ""), else suggestion, else "" (staff choose) —
 *   the fallback is never used for an invoiced delivery.
 */
export function resolveZoneSelection(input: {
  isExternalDriver: boolean;
  manualZoneId: string | null;
  suggestion: ZoneSuggestion | null;
  fallbackZoneId: string | null;
}): ZoneSelection {
  const anchorZoneId =
    input.manualZoneId || input.suggestion?.zoneId || input.fallbackZoneId || "";

  if (input.isExternalDriver) {
    // Shown only if nothing could be worked out, so a delivery can never be
    // blocked by a required field staff can't see.
    return { selectedZoneId: anchorZoneId, showZoneSelect: !anchorZoneId };
  }

  return {
    selectedZoneId:
      input.manualZoneId !== null ? input.manualZoneId : (input.suggestion?.zoneId ?? ""),
    showZoneSelect: true,
  };
}

/**
 * The note under an in-house zone select: where a pre-filled zone came from,
 * or — when staff picked a zone by hand that differs from how this city is
 * usually priced — what the address suggests, so a stale pick gets noticed.
 */
export function zoneHint(input: {
  isExternalDriver: boolean;
  manualZoneId: string | null;
  suggestion: ZoneSuggestion | null;
  city: string;
  zones: SuggestableZone[];
}) {
  if (input.isExternalDriver || !input.suggestion) return null;
  const suggested = input.zones.find((zone) => zone.id === input.suggestion!.zoneId);
  if (!suggested) return null;

  if (input.manualZoneId === null) {
    return describeZoneSuggestion(input.suggestion, input.city, suggested.name);
  }
  if (input.manualZoneId && input.manualZoneId !== input.suggestion.zoneId) {
    const place = input.city.trim();
    return input.suggestion.source === "history"
      ? `Past deliveries to ${place} used the ${suggested.name.trim()} zone — check this is right`
      : `The ${suggested.name.trim()} zone matches ${place} — check this is right`;
  }
  return null;
}
