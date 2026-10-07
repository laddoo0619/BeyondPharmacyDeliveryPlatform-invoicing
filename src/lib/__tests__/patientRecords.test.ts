import { describe, expect, it } from "vitest";
import {
  getAddressDeletionBlocker,
  phonesConflict,
  planAddressMerge,
  recurringProfileUsesAddress,
  sameAddress,
  samePersonName,
} from "@/lib/patientRecords";

describe("getAddressDeletionBlocker", () => {
  it("never lets a patient lose their only address", () => {
    expect(getAddressDeletionBlocker({ isDefault: true, addressCount: 1 })).toBe("LAST_ADDRESS");
    expect(getAddressDeletionBlocker({ isDefault: false, addressCount: 1 })).toBe("LAST_ADDRESS");
  });

  it("protects the default address while others exist", () => {
    expect(getAddressDeletionBlocker({ isDefault: true, addressCount: 3 })).toBe(
      "DEFAULT_ADDRESS"
    );
  });

  it("allows deleting a non-default address when others remain", () => {
    expect(getAddressDeletionBlocker({ isDefault: false, addressCount: 2 })).toBeNull();
  });
});

describe("samePersonName", () => {
  it("matches the same name in any order, case or punctuation", () => {
    expect(samePersonName("Kaur, Simran", "simran  KAUR")).toBe(true);
    expect(samePersonName("Mangat Ravinder", "Ravinder Mangat")).toBe(true);
  });

  it("does not match different people or blank names", () => {
    expect(samePersonName("Simran Kaur", "Simran Gill")).toBe(false);
    expect(samePersonName("", "")).toBe(false);
    expect(samePersonName(null, "Simran Kaur")).toBe(false);
  });
});

describe("phonesConflict", () => {
  it("treats differently formatted numbers as the same", () => {
    expect(phonesConflict("604-555-0100", "(604) 555 0100")).toBe(false);
  });

  it("flags two different numbers, but not a missing one", () => {
    expect(phonesConflict("604-555-0100", "604-555-0199")).toBe(true);
    expect(phonesConflict("604-555-0100", null)).toBe(false);
    expect(phonesConflict("", "604-555-0100")).toBe(false);
  });
});

describe("sameAddress", () => {
  const base = { address: "7355 144 A St", city: "Surrey", postalCode: "V3W 1J3" };

  it("matches common abbreviations and unit spacing", () => {
    expect(
      sameAddress(base, { address: "7355 144A Street", city: "surrey", postalCode: "v3w1j3" })
    ).toBe(true);
  });

  it("tolerates one mistyped secondary field", () => {
    expect(sameAddress(base, { ...base, city: "Delta" })).toBe(true); // postal still agrees
    expect(sameAddress(base, { ...base, postalCode: "V3W 9Z9" })).toBe(true); // city agrees
  });

  it("rejects a different street, or the same street in a different place", () => {
    expect(sameAddress(base, { ...base, address: "16069 56 Avenue" })).toBe(false);
    expect(sameAddress(base, { ...base, city: "Delta", postalCode: "V4C 1A1" })).toBe(false);
    expect(sameAddress({ ...base, address: "" }, { ...base, address: "" })).toBe(false);
  });
});

describe("recurringProfileUsesAddress", () => {
  const patient = { id: "p1", name: "Kaur, Simran" };
  const address = { address: "123 Main St", city: "Surrey", postalCode: "V3S 1A1" };
  const profile = {
    patientId: "p1",
    patientName: "Simran Kaur",
    deliveryAddress: "123 Main Street",
    deliveryCity: "Surrey",
    deliveryPostalCode: "V3S1A1",
  };

  it("finds the patient's own profile still delivering to the address", () => {
    expect(recurringProfileUsesAddress(profile, patient, address)).toBe(true);
  });

  it("falls back to the name for profiles not linked to a patient record", () => {
    expect(recurringProfileUsesAddress({ ...profile, patientId: null }, patient, address)).toBe(
      true
    );
  });

  it("ignores another patient's profile, even at the same address", () => {
    expect(recurringProfileUsesAddress({ ...profile, patientId: "p2" }, patient, address)).toBe(
      false
    );
  });

  it("ignores the patient's profile at a different address", () => {
    expect(
      recurringProfileUsesAddress(
        { ...profile, deliveryAddress: "999 New Road", deliveryPostalCode: "V9Z 9Z9" },
        patient,
        { ...address }
      )
    ).toBe(false);
  });
});

describe("planAddressMerge", () => {
  const current = { id: "t1", address: "16069 56 Avenue", city: "Surrey", postalCode: "V3S 2J7" };
  const old = { id: "s1", address: "6125 175A Street", city: "Surrey", postalCode: "V3S 5E9" };

  it("moves an address the kept patient doesn't have", () => {
    expect(planAddressMerge([current], [old])).toEqual([
      { action: "move", sourceAddressId: "s1" },
    ]);
  });

  it("reuses an address the kept patient already has instead of duplicating it", () => {
    const sameAsCurrent = { ...current, id: "s2", address: "16069 56 Ave" };
    expect(planAddressMerge([current], [sameAsCurrent])).toEqual([
      { action: "reuse", sourceAddressId: "s2", targetAddressId: "t1" },
    ]);
  });

  it("collapses identical addresses within the duplicate record into one", () => {
    const oldAgain = { ...old, id: "s3", address: "6125 175 A St" };
    expect(planAddressMerge([current], [old, oldAgain])).toEqual([
      { action: "move", sourceAddressId: "s1" },
      { action: "reuse", sourceAddressId: "s3", targetAddressId: "s1" },
    ]);
  });
});
