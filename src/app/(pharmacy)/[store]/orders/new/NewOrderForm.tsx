"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PatientAutocomplete } from "@/components/PatientAutocomplete";
import { AddressSelect, type AddressValue } from "@/components/AddressSelect";
import { DriverSelect } from "@/components/DriverSelect";
import { useCreateOrder } from "@/hooks/useCreateOrder";
import type { Patient } from "@/hooks/usePatientSearch";
import {
  card,
  input,
  label,
  primaryButton,
  secondaryButton,
} from "@/lib/portalStyles";
import { EMPTY_ADDRESS, addressFromPatient } from "@/lib/addressForm";

interface Zone {
  id: string;
  name: string;
  price: number;
  defaultDriverId: string | null;
}

interface Driver {
  id: string;
  name: string;
}

export default function NewOrderForm({
  zones,
  drivers,
  storeSlug,
}: {
  zones: Zone[];
  drivers: Driver[];
  storeSlug: string;
}) {
  const router = useRouter();
  const { submit, loading, error } = useCreateOrder(storeSlug);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientNameFreeText, setPatientNameFreeText] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(false);
  const [preferredAddressId, setPreferredAddressId] = useState<string | null>(null);
  const [editingSavedAddress, setEditingSavedAddress] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId]
  );

  const zoneDefaultDriverId = selectedZone?.defaultDriverId ?? null;

  const handleZoneChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedZoneId(id);
      const zone = zones.find((z) => z.id === id);
      setSelectedDriverId(zone?.defaultDriverId ?? "");
    },
    [zones]
  );

  const handleSelectPatient = useCallback((p: Patient) => {
    setSelectedPatient(p);
    setPatientPhone(p.phone ?? "");
    setAddress(addressFromPatient(p));
    setSaveAddress(false);
    setPreferredAddressId(p.matchedAddressId ?? null);
    setEditingSavedAddress(false);
  }, []);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setPatientNameFreeText("");
    setPatientPhone("");
    setAddress(EMPTY_ADDRESS);
    setSaveAddress(false);
    setPreferredAddressId(null);
    setEditingSavedAddress(false);
  }, []);

  const handleFreeTextName = useCallback((name: string) => {
    setPatientNameFreeText(name);
    setPreferredAddressId(null);
  }, []);

  const handleAddressChange = useCallback((v: AddressValue) => {
    setAddress(v);
    if (v.addressId) setSaveAddress(false);
  }, []);

  const handleSaveAddressChange = useCallback((b: boolean) => {
    setSaveAddress(b);
  }, []);

  const handleDriverChange = useCallback((id: string) => {
    setSelectedDriverId(id);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingSavedAddress) return;
    const patientName = selectedPatient?.name ?? patientNameFreeText;
    submit({
      patientId: selectedPatient?.id ?? null,
      patientName,
      patientPhone,
      deliveryAddress: address.address,
      deliveryCity: address.city,
      deliveryPostalCode: address.postalCode,
      deliveryAddressId: address.addressId,
      saveAddressToPatient: saveAddress,
      deliveryZoneId: selectedZoneId,
      assignedDriverId: selectedDriverId || null,
      instructions,
      scheduledDate,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`max-w-2xl ${card} p-6 space-y-4`}
    >
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PatientAutocomplete
          storeSlug={storeSlug}
          selected={selectedPatient}
          onSelect={handleSelectPatient}
          onClear={handleClearPatient}
          onFreeTextChange={handleFreeTextName}
        />
        <div>
          <label className={label}>Patient Phone</label>
          <input
            type="tel"
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <AddressSelect
        key={selectedPatient?.id ?? "new-patient"}
        storeSlug={storeSlug}
        patientId={selectedPatient?.id ?? null}
        value={address}
        onChange={handleAddressChange}
        saveToPatient={saveAddress}
        onSaveToPatientChange={handleSaveAddressChange}
        preferredAddressId={preferredAddressId}
        onEditingSavedAddressChange={setEditingSavedAddress}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={label}>Delivery Zone *</label>
          <select
            required
            value={selectedZoneId}
            onChange={handleZoneChange}
            className={input}
          >
            <option value="">Select zone...</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} — ${zone.price.toFixed(2)}
              </option>
            ))}
          </select>
          {selectedZone && (
            <p className="mt-1 text-sm text-[#6f8f72] font-semibold">
              Delivery price: ${selectedZone.price.toFixed(2)}
            </p>
          )}
        </div>
        <div>
          <label className={label}>Scheduled Date *</label>
          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <DriverSelect
        drivers={drivers}
        value={selectedDriverId}
        onChange={handleDriverChange}
        autoFilledFromZone={
          !!zoneDefaultDriverId && selectedDriverId === zoneDefaultDriverId
        }
      />

      <div>
        <label className={label}>Delivery Instructions</label>
        <textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Leave at door, ring bell, etc."
          className={input}
        />
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          disabled={loading || editingSavedAddress}
          className={primaryButton}
        >
          {loading ? "Creating..." : "Create Order"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className={secondaryButton}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
