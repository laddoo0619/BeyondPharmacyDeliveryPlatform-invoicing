import type { Address, Patient, Prisma } from "@prisma/client";

export interface AddressInput {
  address: string;
  city: string;
  postalCode: string;
  label?: string | null;
}

export interface PatientAddressInput extends AddressInput {
  name: string;
  phone?: string | null;
  storeId: string;
}

interface CleanAddressInput {
  address: string;
  city: string;
  postalCode: string;
  label: string;
}

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function cleanOptionalText(value: unknown) {
  const text = cleanText(value);
  return text ? text : null;
}

export function cleanAddressInput(input: AddressInput): CleanAddressInput {
  return {
    address: cleanText(input.address),
    city: cleanText(input.city),
    postalCode: cleanText(input.postalCode),
    label: cleanOptionalText(input.label) ?? "Saved",
  };
}

export function addressMatchesSearch(
  address: Pick<Address, "address" | "city" | "postalCode">,
  search: string
) {
  const query = search.trim().toLowerCase();
  if (!query) return false;

  return [address.address, address.city, address.postalCode].some((value) =>
    value.toLowerCase().includes(query)
  );
}

export async function findMatchingSavedAddress(
  tx: Prisma.TransactionClient,
  patientId: string,
  input: AddressInput
) {
  const data = cleanAddressInput(input);

  return tx.address.findFirst({
    where: {
      patientId,
      address: { equals: data.address, mode: "insensitive" },
      city: { equals: data.city, mode: "insensitive" },
      postalCode: { equals: data.postalCode, mode: "insensitive" },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function createOrReuseSavedAddress(
  tx: Prisma.TransactionClient,
  patientId: string,
  input: AddressInput,
  options: { label?: string; isDefault?: boolean } = {}
) {
  const data = cleanAddressInput(input);
  const existing = await findMatchingSavedAddress(tx, patientId, data);

  if (existing) {
    if (options.isDefault && !existing.isDefault) {
      await tx.address.updateMany({
        where: { patientId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id: existing.id },
        data: { isDefault: true },
      });
    }

    return existing;
  }

  if (options.isDefault) {
    await tx.address.updateMany({
      where: { patientId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return tx.address.create({
    data: {
      patientId,
      label: options.label ?? data.label,
      address: data.address,
      city: data.city,
      postalCode: data.postalCode,
      isDefault: options.isDefault ?? false,
    },
  });
}

export async function createPatientWithDefaultAddress(
  tx: Prisma.TransactionClient,
  input: PatientAddressInput
): Promise<{ patient: Patient; address: Address }> {
  const address = cleanAddressInput(input);

  const patient = await tx.patient.create({
    data: {
      name: cleanText(input.name),
      phone: cleanOptionalText(input.phone),
      address: address.address,
      city: address.city,
      postalCode: address.postalCode,
      storeId: input.storeId,
    },
  });

  const savedAddress = await tx.address.create({
    data: {
      patientId: patient.id,
      label: "Primary",
      address: address.address,
      city: address.city,
      postalCode: address.postalCode,
      isDefault: true,
    },
  });

  return { patient, address: savedAddress };
}
