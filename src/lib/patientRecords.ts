// Pure rules for cleaning up patient records: deleting saved addresses and
// merging duplicate patient records. No database imports, so the browser can
// apply the same rules the server enforces.
import {
  normalizeName,
  normalizePhone,
  sameDeliveryAddress,
} from "./recurringDuplicateGuard";

// Deliveries in these states are finished: they can no longer be redirected,
// so they don't count as "still using" an address.
export const SETTLED_ORDER_STATUSES = ["DELIVERED", "FAILED", "CANCELLED"];
export const SETTLED_DISPATCH_STATUSES = [
  "DELIVERED",
  "DELIVERY_FAILED",
  "DISPATCH_FAILED",
  "CANCELLED",
];

export interface AddressFields {
  address: string;
  city: string;
  postalCode: string;
}

export type AddressDeletionBlocker = "LAST_ADDRESS" | "DEFAULT_ADDRESS";

export const ADDRESS_DELETION_BLOCKER_MESSAGES: Record<AddressDeletionBlocker, string> = {
  LAST_ADDRESS:
    "This is the patient's only address. Add their new address first, then delete this one.",
  DEFAULT_ADDRESS:
    "This is the patient's default address. Make another address the default first, then delete this one.",
};

/**
 * A patient must always keep at least one address, and the default is never
 * deleted directly: the Patient row mirrors the default, and new orders
 * auto-fill it — guessing a replacement could send medication to the wrong
 * place. Making the new address the default is an explicit, separate step.
 */
export function getAddressDeletionBlocker(input: {
  isDefault: boolean;
  addressCount: number;
}): AddressDeletionBlocker | null {
  if (input.addressCount <= 1) return "LAST_ADDRESS";
  if (input.isDefault) return "DEFAULT_ADDRESS";
  return null;
}

// "Kaur, Simran" and "simran KAUR" are the same name.
export function samePersonName(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeName(a);
  return left !== "" && left === normalizeName(b);
}

export function phonesConflict(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  return left !== "" && right !== "" && left !== right;
}

// "Same address" is defined once, beside the normalizers, and shared with the
// recurring guard and the cron so the whole app agrees on it.
export function sameAddress(a: AddressFields, b: AddressFields) {
  return sameDeliveryAddress(a, b);
}

export interface RecurringProfileAddress {
  patientId: string | null;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
}

// Recurring profiles store address text, not a saved-address id, so deleting a
// saved address never changes where a profile delivers. This finds the
// profiles that would keep delivering to an address staff are removing.
export function recurringProfileUsesAddress(
  profile: RecurringProfileAddress,
  patient: { id: string; name: string },
  address: AddressFields
) {
  const samePatient = profile.patientId
    ? profile.patientId === patient.id
    : samePersonName(profile.patientName, patient.name);

  return (
    samePatient &&
    sameAddress(
      {
        address: profile.deliveryAddress,
        city: profile.deliveryCity,
        postalCode: profile.deliveryPostalCode,
      },
      address
    )
  );
}

export type AddressMergeStep =
  | { action: "move"; sourceAddressId: string }
  | { action: "reuse"; sourceAddressId: string; targetAddressId: string };

/**
 * When merging a duplicate patient, each of its addresses either already
 * exists on the patient being kept (reuse it, so no duplicate address is
 * created) or is moved across as a non-default saved address.
 */
export function planAddressMerge(
  targetAddresses: Array<AddressFields & { id: string }>,
  sourceAddresses: Array<AddressFields & { id: string }>
): AddressMergeStep[] {
  // Addresses moved earlier in this merge count as already on the target, so
  // two identical addresses on the duplicate collapse into one.
  const known = [...targetAddresses];

  return sourceAddresses.map((source): AddressMergeStep => {
    const existing = known.find((target) => sameAddress(target, source));
    if (existing) {
      return { action: "reuse", sourceAddressId: source.id, targetAddressId: existing.id };
    }
    known.push(source);
    return { action: "move", sourceAddressId: source.id };
  });
}
