import { describe, expect, it } from "vitest";
import { REMINDER_HOUR, isReminderDue } from "@/lib/reminderSchedule";
import { vancouverHour } from "@/lib/vancouverDate";
import {
  addWeeks,
  parseReminderDateKey,
  toReminderDateKey,
  toReminderView,
} from "@/lib/reminders";

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

describe("isReminderDue", () => {
  it("is not due before 10 AM Vancouver", () => {
    expect(isReminderDue(new Date("2026-07-15T16:59:00Z"))).toBe(false);
    expect(isReminderDue(new Date("2026-07-15T13:00:00Z"))).toBe(false); // 6 AM
  });

  it("is due from 10 AM onward, not only during the 10 AM hour", () => {
    expect(isReminderDue(new Date("2026-07-15T17:00:00Z"))).toBe(true);
    expect(isReminderDue(new Date("2026-07-15T21:00:00Z"))).toBe(true); // 2 PM
  });

  it("holds across the DST change", () => {
    expect(isReminderDue(new Date("2026-01-15T18:00:00Z"))).toBe(true);
    expect(isReminderDue(new Date("2026-01-15T17:00:00Z"))).toBe(false);
  });

  it("fires at the documented hour", () => {
    expect(REMINDER_HOUR).toBe(10);
  });
});

describe("parseReminderDateKey", () => {
  it("accepts a date-input value and pins it to UTC midnight", () => {
    expect(parseReminderDateKey("2026-09-04")?.toISOString()).toBe(
      "2026-09-04T00:00:00.000Z"
    );
  });

  it("rejects anything that isn't a plain day key", () => {
    for (const bad of ["", "not-a-date", "2026-9-4", "2026-09-04T10:00:00Z", 20260904, null]) {
      expect(parseReminderDateKey(bad)).toBeNull();
    }
  });

  it("round-trips through toReminderDateKey", () => {
    const key = "2026-12-31";
    expect(toReminderDateKey(parseReminderDateKey(key)!)).toBe(key);
  });
});

describe("addWeeks", () => {
  it("advances a repeat to its next occurrence", () => {
    const start = parseReminderDateKey("2026-09-04")!;
    expect(toReminderDateKey(addWeeks(start, 4))).toBe("2026-10-02");
    expect(toReminderDateKey(addWeeks(start, 1))).toBe("2026-09-11");
  });

  it("crosses a DST boundary without drifting off the weekday", () => {
    // Nov 1 2026 is the PDT->PST change; the repeat must stay on a Friday.
    const start = parseReminderDateKey("2026-10-30")!;
    expect(toReminderDateKey(addWeeks(start, 2))).toBe("2026-11-13");
  });
});

describe("toReminderView", () => {
  const today = new Date("2026-09-04T00:00:00.000Z");
  const base = {
    id: "r1",
    note: "Fridge item — Ozempic",
    patientName: "Kaur, Simran",
    repeatIntervalWeeks: null,
    completedAt: null,
  };

  it("flags an open reminder from a past day as overdue", () => {
    const view = toReminderView(
      { ...base, remindOn: new Date("2026-09-03T00:00:00.000Z") },
      today
    );
    expect(view.isOverdue).toBe(true);
    expect(view.remindOn).toBe("2026-09-03");
  });

  it("does not flag today or the future as overdue", () => {
    expect(toReminderView({ ...base, remindOn: today }, today).isOverdue).toBe(false);
    expect(
      toReminderView({ ...base, remindOn: new Date("2026-09-05T00:00:00.000Z") }, today)
        .isOverdue
    ).toBe(false);
  });

  it("never marks a completed reminder overdue", () => {
    const view = toReminderView(
      {
        ...base,
        remindOn: new Date("2026-08-01T00:00:00.000Z"),
        completedAt: new Date("2026-08-01T18:00:00.000Z"),
      },
      today
    );
    expect(view.isOverdue).toBe(false);
    expect(view.completedAt).not.toBeNull();
  });
});
