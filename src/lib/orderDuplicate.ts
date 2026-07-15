// Same-day duplicate matching shared by the orders API (in-house Orders AND
// Spoke ExternalDispatch rows). Extracted from the route file so it can be
// unit-tested — Next.js route modules may only export handlers/config.

export interface DuplicateMatchFields {
  patientId: string | null;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
}

export function normalizeDuplicateText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizePostalCode(value: string) {
  return normalizeDuplicateText(value).replace(/\s/g, "");
}

export function orderMatchesDuplicate(
  order: DuplicateMatchFields,
  input: DuplicateMatchFields
) {
  const samePatient = input.patientId
    ? order.patientId === input.patientId
    : normalizeDuplicateText(order.patientName) ===
      normalizeDuplicateText(input.patientName);

  return (
    samePatient &&
    normalizeDuplicateText(order.deliveryAddress) ===
      normalizeDuplicateText(input.deliveryAddress) &&
    normalizeDuplicateText(order.deliveryCity) ===
      normalizeDuplicateText(input.deliveryCity) &&
    normalizePostalCode(order.deliveryPostalCode) ===
      normalizePostalCode(input.deliveryPostalCode)
  );
}
