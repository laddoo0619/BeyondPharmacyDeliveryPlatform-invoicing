import { describe, expect, it } from "vitest";
import { FRIDGE_REMINDER_HOUR, isFridgeReminderDue } from "@/lib/fridgeSchedule";
import { vancouverHour } from "@/lib/vancouverDate";

describe("vancouverHour", () => {
  it("reads the Vancouver wall-clock hour in summer (PDT, UTC-7)", () => {
    expect(vancouverHour(new Date("2026-07-15T17:00:00Z"))).toBe(10);
    expect(vancouverHour(new Date("2026-07-15T16:59:00Z"))).toBe(9);
  });

  it("reads it in winter (PST, UTC-8)", () => {
    expect(vancouverHour(new Date("2026-01-15T18:00:00Z"))).toBe(10);
    expect(vancouverHour(new Date("2026-01-15T17:59:00Z"))).toBe(9);
  });

  it("maps midnight to 0, never 24", () => {
    expect(vancouverHour(new Date("2026-07-15T07:00:00Z"))).toBe(0);
  });
});

describe("isFridgeReminderDue", () => {
  it("is not due before 10 AM Vancouver", () => {
    expect(isFridgeReminderDue(new Date("2026-07-15T16:59:00Z"))).toBe(false);
    // 6 AM, when the cron generates the day's orders.
    expect(isFridgeReminderDue(new Date("2026-07-15T13:00:00Z"))).toBe(false);
  });

  it("is due from 10 AM onward, not only during the 10 AM hour", () => {
    expect(isFridgeReminderDue(new Date("2026-07-15T17:00:00Z"))).toBe(true);
    // 2 PM — someone logging in later must still be reminded.
    expect(isFridgeReminderDue(new Date("2026-07-15T21:00:00Z"))).toBe(true);
  });

  it("holds across the DST change", () => {
    expect(isFridgeReminderDue(new Date("2026-01-15T18:00:00Z"))).toBe(true);
    expect(isFridgeReminderDue(new Date("2026-01-15T17:00:00Z"))).toBe(false);
  });

  it("reminds at the documented hour", () => {
    expect(FRIDGE_REMINDER_HOUR).toBe(10);
  });
});

// The status filters live in fridge.ts (which imports prisma); importing the
// constants alone runs no queries. These pin the exact regression found in
// post-merge review: PICKED_UP was missing, so a fridge order the driver had
// just loaded into the van disappeared from the 10 AM list.
describe("fridge checklist status filters", () => {
  it("keeps every order status a fridge item can still be acted on", async () => {
    const { SETTLED_ORDER_STATUSES } = await import("@/lib/fridge");
    for (const status of ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"]) {
      expect(SETTLED_ORDER_STATUSES).not.toContain(status);
    }
  });

  it("drops settled orders so the popup can't nag about them", async () => {
    const { SETTLED_ORDER_STATUSES } = await import("@/lib/fridge");
    for (const status of ["DELIVERED", "FAILED", "CANCELLED"]) {
      expect(SETTLED_ORDER_STATUSES).toContain(status);
    }
  });

  it("keeps live Anchor dispatch statuses on the list", async () => {
    const { SETTLED_DISPATCH_STATUSES } = await import("@/lib/fridge");
    for (const status of [
      "PENDING",
      "SCHEDULED",
      "STOP_CREATED",
      "SUBMITTED",
      "ALLOCATED",
      "IN_TRANSIT",
      "DEPARTED",
    ]) {
      expect(SETTLED_DISPATCH_STATUSES).not.toContain(status);
    }
  });

  it("drops settled Anchor dispatches, including a failed delivery attempt", async () => {
    const { SETTLED_DISPATCH_STATUSES } = await import("@/lib/fridge");
    for (const status of [
      "DELIVERED",
      "DELIVERY_FAILED",
      "DISPATCH_FAILED",
      "CANCELLED",
    ]) {
      expect(SETTLED_DISPATCH_STATUSES).toContain(status);
    }
  });
});
