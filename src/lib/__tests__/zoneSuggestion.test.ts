import { describe, expect, it } from "vitest";
import {
  buildZoneHistory,
  describeZoneSuggestion,
  normalizeCityKey,
  pickFallbackZoneId,
  resolveZoneSelection,
  suggestZone,
  zoneHint,
} from "@/lib/zoneSuggestion";

// Mirrors the Surrey store's real zones, including the trailing spaces some
// zone names carry in production.
const zones = [
  { id: "z_surrey", name: "Surrey" },
  { id: "z_langley", name: "Langley" },
  { id: "z_aldergrove", name: "Langley Township/Aldergrove " },
  { id: "z_coquitlam", name: "Coquitlam" },
  { id: "z_whiterock", name: "White rock" },
  { id: "z_richmond", name: "Richmond" },
  { id: "z_abbotsford", name: "abbotsford " },
  { id: "z_daily", name: "Daily Dispense " },
];

// Shapes taken from real in-house order history (Derek's pay).
const history = buildZoneHistory([
  { city: "Delta", zoneId: "z_surrey", count: 52, lastUsed: "2026-09-30T00:00:00.000Z" },
  { city: "Langley", zoneId: "z_langley", count: 233, lastUsed: "2026-09-30T00:00:00.000Z" },
  { city: "Langley", zoneId: "z_surrey", count: 146, lastUsed: "2026-09-29T00:00:00.000Z" },
  { city: "Langley Township", zoneId: "z_langley", count: 8, lastUsed: "2026-09-01T00:00:00.000Z" },
  { city: "Surrey", zoneId: "z_surrey", count: 1258, lastUsed: "2026-10-01T00:00:00.000Z" },
  { city: "Surrey", zoneId: "z_langley", count: 10, lastUsed: "2026-08-01T00:00:00.000Z" },
  { city: "Pitt Meadows", zoneId: "z_abbotsford", count: 2, lastUsed: "2026-07-01T00:00:00.000Z" },
]);

describe("suggestZone — past pricing comes first", () => {
  it("prices Delta at the Surrey zone, which has no Delta zone of its own", () => {
    expect(suggestZone({ city: "Delta", zones, history })).toEqual({
      zoneId: "z_surrey",
      source: "history",
      count: 52,
    });
  });

  it("keeps Langley Township on the $4.25 Langley rate, not the $10 Aldergrove zone", () => {
    expect(suggestZone({ city: "Langley Township", zones, history })?.zoneId).toBe("z_langley");
  });

  it("takes the most-used zone when a city has been priced more than one way", () => {
    expect(suggestZone({ city: "langley", zones, history })?.zoneId).toBe("z_langley");
  });

  it("breaks a tie with the most recent delivery", () => {
    const tied = buildZoneHistory([
      { city: "Port Moody", zoneId: "z_coquitlam", count: 2, lastUsed: "2026-01-01T00:00:00.000Z" },
      { city: "Port Moody", zoneId: "z_surrey", count: 2, lastUsed: "2026-09-01T00:00:00.000Z" },
    ]);
    expect(suggestZone({ city: "Port Moody", zones, history: tied })?.zoneId).toBe("z_surrey");
  });

  it("ignores history for a zone that is no longer offered", () => {
    const retired = buildZoneHistory([
      { city: "Richmond", zoneId: "z_retired", count: 40, lastUsed: null },
    ]);
    expect(suggestZone({ city: "Richmond", zones, history: retired })).toEqual({
      zoneId: "z_richmond",
      source: "name",
      count: 0,
    });
  });
});

describe("suggestZone — exact name match, never a prefix", () => {
  it("matches a city to the zone of the same name", () => {
    expect(suggestZone({ city: "Richmond", zones, history: {} })?.zoneId).toBe("z_richmond");
  });

  it("ignores case, spacing and trailing spaces in zone names", () => {
    for (const city of ["White Rock", "whiterock", "  WHITE  ROCK "]) {
      expect(suggestZone({ city, zones, history: {} })?.zoneId).toBe("z_whiterock");
    }
    expect(suggestZone({ city: "Abbotsford", zones, history: {} })?.zoneId).toBe("z_abbotsford");
  });

  it("does not prefix-match Langley Township to the Aldergrove zone", () => {
    expect(suggestZone({ city: "Langley Township", zones, history: {} })).toBeNull();
  });

  it("returns nothing for an unknown or blank city", () => {
    expect(suggestZone({ city: "Hope", zones, history })).toBeNull();
    expect(suggestZone({ city: "   ", zones, history })).toBeNull();
    expect(suggestZone({ city: null, zones, history })).toBeNull();
  });
});

describe("buildZoneHistory", () => {
  it("merges spellings of the same city and keeps the latest use", () => {
    const merged = buildZoneHistory([
      { city: "Langley", zoneId: "z_langley", count: 3, lastUsed: "2026-01-01T00:00:00.000Z" },
      { city: "langley ", zoneId: "z_langley", count: 2, lastUsed: new Date("2026-05-01T00:00:00Z") },
    ]);
    expect(merged[normalizeCityKey("Langley")]).toEqual([
      { zoneId: "z_langley", count: 5, lastUsed: "2026-05-01T00:00:00.000Z" },
    ]);
  });

  it("skips rows without a city or zone", () => {
    expect(
      buildZoneHistory([
        { city: "", zoneId: "z_surrey", count: 4, lastUsed: null },
        { city: "Surrey", zoneId: null, count: 4, lastUsed: null },
      ])
    ).toEqual({});
  });
});

describe("pickFallbackZoneId (Anchor only — price is never invoiced)", () => {
  it("uses the store's most-used zone", () => {
    expect(pickFallbackZoneId(zones, history)).toBe("z_surrey");
  });

  it("falls back to the first zone by name when there is no history", () => {
    expect(pickFallbackZoneId(zones, {})).toBe("z_abbotsford");
  });

  it("returns null when the store offers no zones", () => {
    expect(pickFallbackZoneId([], history)).toBeNull();
  });
});

describe("describeZoneSuggestion", () => {
  it("explains a history-based suggestion", () => {
    expect(
      describeZoneSuggestion({ zoneId: "z_surrey", source: "history", count: 52 }, "Delta", "Surrey")
    ).toBe("Suggested from 52 past deliveries to Delta — check before saving");
  });

  it("explains a name match", () => {
    expect(
      describeZoneSuggestion({ zoneId: "z_whiterock", source: "name", count: 0 }, "White Rock", "White rock")
    ).toBe("Matched to the White rock zone by city — check before saving");
  });
});

describe("resolveZoneSelection", () => {
  const suggestion = { zoneId: "z_surrey", source: "history" as const, count: 52 };
  const base = { suggestion, fallbackZoneId: "z_langley" };

  it("pre-fills an in-house delivery from the suggestion and shows the select", () => {
    expect(resolveZoneSelection({ ...base, isExternalDriver: false, manualZoneId: null })).toEqual({
      selectedZoneId: "z_surrey",
      showZoneSelect: true,
    });
  });

  it("never uses the fallback zone for an invoiced (in-house) delivery", () => {
    expect(
      resolveZoneSelection({ ...base, suggestion: null, isExternalDriver: false, manualZoneId: null })
    ).toEqual({ selectedZoneId: "", showZoneSelect: true });
  });

  it("keeps a hand-picked zone, even when the address suggests another", () => {
    expect(
      resolveZoneSelection({ ...base, isExternalDriver: false, manualZoneId: "z_daily" }).selectedZoneId
    ).toBe("z_daily");
  });

  it("respects staff clearing the zone for an in-house delivery", () => {
    expect(
      resolveZoneSelection({ ...base, isExternalDriver: false, manualZoneId: "" }).selectedZoneId
    ).toBe("");
  });

  it("hides the select for Anchor and assigns the suggestion, else the fallback", () => {
    expect(resolveZoneSelection({ ...base, isExternalDriver: true, manualZoneId: null })).toEqual({
      selectedZoneId: "z_surrey",
      showZoneSelect: false,
    });
    expect(
      resolveZoneSelection({ ...base, suggestion: null, isExternalDriver: true, manualZoneId: null })
    ).toEqual({ selectedZoneId: "z_langley", showZoneSelect: false });
  });

  it("never blocks Anchor: a cleared zone still resolves, and the select reappears only if nothing does", () => {
    expect(
      resolveZoneSelection({ ...base, isExternalDriver: true, manualZoneId: "" }).selectedZoneId
    ).toBe("z_surrey");
    expect(
      resolveZoneSelection({ suggestion: null, fallbackZoneId: null, isExternalDriver: true, manualZoneId: null })
    ).toEqual({ selectedZoneId: "", showZoneSelect: true });
  });
});

describe("zoneHint", () => {
  const suggestion = { zoneId: "z_langley", source: "history" as const, count: 6 };
  const hint = (overrides: Partial<Parameters<typeof zoneHint>[0]>) =>
    zoneHint({
      isExternalDriver: false,
      manualZoneId: null,
      suggestion,
      city: "Langley Township",
      zones,
      ...overrides,
    });

  it("explains a pre-filled zone", () => {
    expect(hint({})).toBe("Suggested from 6 past deliveries to Langley Township — check before saving");
  });

  it("flags a hand-picked zone that differs from how the city is usually priced", () => {
    expect(hint({ manualZoneId: "z_aldergrove" })).toBe(
      "Past deliveries to Langley Township used the Langley zone — check this is right"
    );
  });

  it("flags a hand-picked zone that differs from a name match", () => {
    expect(
      hint({
        manualZoneId: "z_surrey",
        city: "Richmond",
        suggestion: { zoneId: "z_richmond", source: "name", count: 0 },
      })
    ).toBe("The Richmond zone matches Richmond — check this is right");
  });

  it("says nothing when the pick agrees, the zone was cleared, there is no suggestion, or it is Anchor", () => {
    expect(hint({ manualZoneId: "z_langley" })).toBeNull();
    expect(hint({ manualZoneId: "" })).toBeNull();
    expect(hint({ suggestion: null })).toBeNull();
    expect(hint({ isExternalDriver: true })).toBeNull();
  });
});
