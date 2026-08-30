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
import { vancouverTodayKey } from "@/lib/vancouverDate";

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
  const { submit, loading, error, duplicate } = useCreateOrder(storeSlug);

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
  const [hasFridgeItem, setHasFridgeItem] = useState(false);
  const [fridgeItemNote, setFridgeItemNote] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    // Vancouver's today — toISOString() would default to tomorrow after ~5 PM Pacific.
    () => vancouverTodayKey()
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

  const buildInput = (allowDuplicate: boolean) => ({
    patientId: selectedPatient?.id ?? null,
    patientName: selectedPatient?.name ?? patientNameFreeText,
    patientPhone,
    deliveryAddress: address.address,
    deliveryCity: address.city,
    deliveryPostalCode: address.postalCode,
    deliveryAddressId: address.addressId,
    saveAddressToPatient: saveAddress,
    deliveryZoneId: selectedZoneId,
    assignedDriverId: selectedDriverId,
    instructions,
    scheduledDate,
    allowDuplicate,
    hasFridgeItem,
    fridgeItemNote,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingSavedAddress) return;
    // Driver assignment is mandatory — the select is `required`, this is a guard
    // for completeness (the server enforces it too).
    if (!selectedDriverId) return;
    submit(buildInput(false));
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

      {duplicate && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm space-y-2">
          <p>
            This client already has a{" "}
            {duplicate.kind === "SPOKE" ? "Spoke/Anchor" : "driver"} delivery
            today (status: {duplicate.status}). Check the Orders page first —
            if this is an intentional second delivery, confirm below.
          </p>
          <button
            type="button"
            onClick={() => submit(buildInput(true))}
            disabled={loading || editingSavedAddress || !selectedDriverId}
            className="rounded-full border border-amber-400 bg-white px-4 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create second delivery anyway"}
          </button>
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
        required
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

      {/* Puts this delivery on today's 10 AM fridge reminder. For clients who
          always have a fridge item, set it on their recurring profile instead
          so it applies to every delivery automatically. */}
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={hasFridgeItem}
            onChange={(e) => setHasFridgeItem(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#6f8f72] focus:ring-[#6f8f72]"
          />
          <span className="text-sm font-medium text-slate-700">
            🧊 Fridge item — remind staff to pull it before this delivery
          </span>
        </label>
        {hasFridgeItem && (
          <input
            type="text"
            value={fridgeItemNote}
            onChange={(e) => setFridgeItemNote(e.target.value)}
            placeholder="Which item? (e.g. Ozempic) — optional"
            maxLength={200}
            className={`${input} mt-2`}
          />
        )}
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
