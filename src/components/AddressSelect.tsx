"use client";

import { memo, useEffect, useMemo } from "react";
import { usePatientAddresses, type SavedAddress } from "@/hooks/usePatientAddresses";
import { cn, input, inputReadOnly, label } from "@/lib/portalStyles";

export interface AddressValue {
  addressId: string | null;
  address: string;
  city: string;
  postalCode: string;
}

interface Props {
  storeSlug: string;
  patientId: string | null;
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  saveToPatient: boolean;
  onSaveToPatientChange: (b: boolean) => void;
}

const NEW_ADDRESS = "__new__";

function AddressSelectInner({
  storeSlug,
  patientId,
  value,
  onChange,
  saveToPatient,
  onSaveToPatientChange,
}: Props) {
  const { addresses } = usePatientAddresses(storeSlug, patientId);

  const defaultAddressId = useMemo(
    () => addresses.find((a) => a.isDefault)?.id ?? null,
    [addresses]
  );

  // Auto-select default address once addresses load for a patient
  useEffect(() => {
    if (!patientId) return;
    if (value.addressId) return;
    if (!defaultAddressId) return;
    const def = addresses.find((a) => a.id === defaultAddressId);
    if (!def) return;
    onChange({
      addressId: def.id,
      address: def.address,
      city: def.city,
      postalCode: def.postalCode,
    });
  }, [patientId, defaultAddressId, addresses, value.addressId, onChange]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === NEW_ADDRESS) {
      onChange({ addressId: null, address: "", city: "", postalCode: "" });
      return;
    }
    const a = addresses.find((x) => x.id === id);
    if (a) {
      onChange({
        addressId: a.id,
        address: a.address,
        city: a.city,
        postalCode: a.postalCode,
      });
    }
  };

  const isEditing = !value.addressId;
  const showPicker = !!patientId && addresses.length > 0;

  return (
    <div className="space-y-3">
      {showPicker && (
        <div>
          <label className={label}>Saved Address</label>
          <select
            value={value.addressId ?? NEW_ADDRESS}
            onChange={handleSelect}
            className={input}
          >
            {addresses.map((a: SavedAddress) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.address}, {a.city} {a.postalCode}
                {a.isDefault ? " (default)" : ""}
              </option>
            ))}
            <option value={NEW_ADDRESS}>+ New address…</option>
          </select>
        </div>
      )}

      <div>
        <label className={label}>Delivery Address *</label>
        <input
          required
          value={value.address}
          readOnly={!isEditing}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className={cn(input, !isEditing && inputReadOnly)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={label}>City *</label>
          <input
            required
            value={value.city}
            readOnly={!isEditing}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            className={cn(input, !isEditing && inputReadOnly)}
          />
        </div>
        <div>
          <label className={label}>Postal Code *</label>
          <input
            required
            value={value.postalCode}
            readOnly={!isEditing}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
            className={cn(input, !isEditing && inputReadOnly)}
          />
        </div>
      </div>

      {isEditing && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={saveToPatient}
            onChange={(e) => onSaveToPatientChange(e.target.checked)}
            disabled={!patientId}
            className="rounded border-slate-300 text-[#6f8f72] focus:ring-[#6f8f72]"
          />
          <span className={patientId ? "" : "text-slate-400"}>
            Save this address for future orders
            {!patientId && " (select a patient first)"}
          </span>
        </label>
      )}
    </div>
  );
}

export const AddressSelect = memo(AddressSelectInner);
