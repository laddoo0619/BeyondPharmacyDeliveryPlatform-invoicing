import { describe, expect, it } from "vitest";
import { vancouverTodayKey } from "@/lib/vancouverDate";

describe("vancouverTodayKey", () => {
  it("stays on Vancouver's date after UTC midnight in summer (PDT, UTC-7)", () => {
    expect(vancouverTodayKey(new Date("2026-07-16T00:30:00Z"))).toBe("2026-07-15");
    expect(vancouverTodayKey(new Date("2026-07-16T07:01:00Z"))).toBe("2026-07-16");
  });

  it("handles the PST offset in winter (UTC-8)", () => {
    expect(vancouverTodayKey(new Date("2026-01-16T07:59:00Z"))).toBe("2026-01-15");
    expect(vancouverTodayKey(new Date("2026-01-16T08:00:00Z"))).toBe("2026-01-16");
  });
});
