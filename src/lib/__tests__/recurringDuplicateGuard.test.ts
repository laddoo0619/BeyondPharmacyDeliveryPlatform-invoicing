import { describe, expect, it } from "vitest";
import { parseRecurringActiveDays, recurringPeopleMatch } from "@/lib/recurringDuplicateGuard";

const person = {
  patientId: null,
  patientName: "Kimbelee Home",
  patientPhone: "604-555-0100",
  deliveryAddress: "123 Main St",
  deliveryCity: "Delta",
  deliveryPostalCode: "V4C 1A1",
};

describe("recurringPeopleMatch", () => {
  it("matches the same person with reordered name tokens and different casing", () => {
    expect(recurringPeopleMatch(person, { ...person, patientName: "home KIMBELEE" })).toBe(true);
  });

  it("does not match a different person at a different address", () => {
    expect(
      recurringPeopleMatch(person, {
        ...person,
        patientName: "Someone Else",
        patientPhone: "604-555-9999",
        deliveryAddress: "999 Other Rd",
        deliveryPostalCode: "V9Z 9Z9",
      })
    ).toBe(false);
  });
});

describe("parseRecurringActiveDays", () => {
  it("accepts valid day arrays", () => {
    expect(parseRecurringActiveDays([1, 3, 5])).toEqual([1, 3, 5]);
  });

  it("rejects empty, malformed, and out-of-range input", () => {
    expect(parseRecurringActiveDays([])).toBeNull();
    expect(parseRecurringActiveDays("not-days")).toBeNull();
    expect(parseRecurringActiveDays([9])).toBeNull();
  });
});
