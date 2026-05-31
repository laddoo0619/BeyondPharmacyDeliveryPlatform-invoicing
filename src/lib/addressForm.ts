import type { AddressValue } from "@/components/AddressSelect";
import type { Patient } from "@/hooks/usePatientSearch";

export const EMPTY_ADDRESS: AddressValue = {
  addressId: null,
  address: "",
  city: "",
  postalCode: "",
};

export function addressFromPatient(patient: Patient): AddressValue {
  if (patient.matchedAddress) {
    return {
      addressId: patient.matchedAddress.id,
      address: patient.matchedAddress.address,
      city: patient.matchedAddress.city,
      postalCode: patient.matchedAddress.postalCode,
    };
  }

  return {
    addressId: null,
    address: patient.address,
    city: patient.city,
    postalCode: patient.postalCode,
  };
}
