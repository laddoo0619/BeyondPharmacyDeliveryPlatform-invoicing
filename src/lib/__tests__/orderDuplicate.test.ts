import { describe, expect, it } from "vitest";
import {
  normalizeDuplicateText,
  normalizePostalCode,
  orderMatchesDuplicate,
} from "@/lib/orderDuplicate";

const base = {
  patientId: null,
  patientName: "Kimbelee Home",
  deliveryAddress: "123 Main St",
  deliveryCity: "Delta",
  deliveryPostalCode: "V4C 1A1",
};

describe("orderMatchesDuplicate", () => {
  it("matches a re-entered delivery despite case and spacing differences", () => {
    // The Jul 14 2026 incident shape: same person/address re-submitted moments
    // later with a fresh browser identity.
    expect(
      orderMatchesDuplicate(base, {
        ...base,
        patientName: "  kimbelee   HOME ",
        deliveryAddress: "123  main st",
        deliveryPostalCode: "v4c1a1",
      })
    ).toBe(true);
  });

  it("matches by patient id even when the display name differs", () => {
    expect(
      orderMatchesDuplicate(
        { ...base, patientId: "p1", patientName: "Home, Kimbelee" },
        { ...base, patientId: "p1" }
      )
    ).toBe(true);
  });

  it("does not match a different patient id", () => {
    expect(
      orderMatchesDuplicate({ ...base, patientId: "p1" }, { ...base, patientId: "p2" })
    ).toBe(false);
  });

  it("does not match a different address or city", () => {
    expect(orderMatchesDuplicate(base, { ...base, deliveryAddress: "999 Other Rd" })).toBe(false);
    expect(orderMatchesDuplicate(base, { ...base, deliveryCity: "Surrey" })).toBe(false);
  });
});

describe("normalizers", () => {
  it("collapses whitespace and case", () => {
    expect(normalizeDuplicateText("  A   B ")).toBe("a b");
  });

  it("strips postal-code spacing", () => {
    expect(normalizePostalCode(" V4C 1A1 ")).toBe("v4c1a1");
  });
});
