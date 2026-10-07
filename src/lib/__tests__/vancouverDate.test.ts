import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  defaultDeliveryDateKey,
  describeDeliveryDay,
  vancouverTodayKey,
} from "@/lib/vancouverDate";

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

describe("addDaysToDateKey", () => {
  it("rolls over months and years", () => {
    expect(addDaysToDateKey("2026-10-07", 1)).toBe("2026-10-08");
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is unaffected by daylight-saving changes", () => {
    expect(addDaysToDateKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToDateKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2026-11-01", 1)).toBe("2026-11-02");
  });
});

describe("defaultDeliveryDateKey (orders entered from noon go out tomorrow)", () => {
  // Summer (PDT, UTC-7): noon in Vancouver is 19:00 UTC.
  it("keeps today in the morning", () => {
    expect(defaultDeliveryDateKey(new Date("2026-07-15T15:00:00Z"))).toBe("2026-07-15"); // 08:00
    expect(defaultDeliveryDateKey(new Date("2026-07-15T18:59:59Z"))).toBe("2026-07-15"); // 11:59:59
  });

  it("switches to tomorrow from 12:00 PM", () => {
    expect(defaultDeliveryDateKey(new Date("2026-07-15T19:00:00Z"))).toBe("2026-07-16"); // 12:00
    expect(defaultDeliveryDateKey(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16"); // 16:30
  });

  it("uses Vancouver's date, not UTC's, late in the evening", () => {
    // 23:30 PDT on Jul 15 is already Jul 16 in UTC — still delivers Jul 16.
    expect(defaultDeliveryDateKey(new Date("2026-07-16T06:30:00Z"))).toBe("2026-07-16");
    // 00:30 PDT on Jul 16 — a new morning, so Jul 16 itself.
    expect(defaultDeliveryDateKey(new Date("2026-07-16T07:30:00Z"))).toBe("2026-07-16");
  });

  it("handles winter time (PST, UTC-8)", () => {
    expect(defaultDeliveryDateKey(new Date("2026-01-15T19:59:00Z"))).toBe("2026-01-15"); // 11:59
    expect(defaultDeliveryDateKey(new Date("2026-01-15T20:00:00Z"))).toBe("2026-01-16"); // 12:00
  });

  it("rolls over the month and year", () => {
    expect(defaultDeliveryDateKey(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01"); // 1 PM PST
  });

  it("does it on daylight-saving change days too", () => {
    // Nov 1 2026: clocks fall back at 2 AM; noon PST is 20:00 UTC.
    expect(defaultDeliveryDateKey(new Date("2026-11-01T19:59:00Z"))).toBe("2026-11-01");
    expect(defaultDeliveryDateKey(new Date("2026-11-01T20:00:00Z"))).toBe("2026-11-02");
    // Mar 8 2026: clocks spring forward; noon PDT is 19:00 UTC.
    expect(defaultDeliveryDateKey(new Date("2026-03-08T18:59:00Z"))).toBe("2026-03-08");
    expect(defaultDeliveryDateKey(new Date("2026-03-08T19:00:00Z"))).toBe("2026-03-09");
  });
});

describe("describeDeliveryDay", () => {
  const now = new Date("2026-10-07T20:00:00Z"); // Wed Oct 7, 1 PM PDT

  it("says today and tomorrow in Vancouver terms", () => {
    expect(describeDeliveryDay("2026-10-07", now)).toBe("today");
    expect(describeDeliveryDay("2026-10-08", now)).toBe("tomorrow");
  });

  it("names any other day without shifting it a day", () => {
    expect(describeDeliveryDay("2026-10-12", now)).toBe("on Mon, Oct 12");
    expect(describeDeliveryDay("2026-10-06", now)).toBe("on Tue, Oct 6");
  });
});
