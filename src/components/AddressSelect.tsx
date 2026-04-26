"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { usePatientAddresses, type SavedAddress } from "@/hooks/usePatientAddresses";
import {
  cn,
  input,
  inputReadOnly,
  label,
  primaryButton,
  secondaryButton,
  softButton,
} from "@/lib/portalStyles";

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
  preferredAddressId?: string | null;
  onEditingSavedAddressChange?: (editing: boolean) => void;
}

const NEW_ADDRESS = "__new__";
const EMPTY_ADDRESS: AddressValue = {
  addressId: null,
  address: "",
  city: "",
  postalCode: "",
};

function toAddressValue(address: SavedAddress): AddressValue {
  return {
    addressId: address.id,
    address: address.address,
    city: address.city,
    postalCode: address.postalCode,
  };
}

function AddressSelectInner({
  storeSlug,
  patientId,
  value,
  onChange,
  saveToPatient,
  onSaveToPatientChange,
  preferredAddressId = null,
  onEditingSavedAddressChange,
}: Props) {
  const { addresses, loading, refresh } = usePatientAddresses(storeSlug, patientId);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressValue>(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const defaultAddressId = useMemo(
    () => addresses.find((a) => a.isDefault)?.id ?? null,
    [addresses]
  );

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === value.addressId) ?? null,
    [addresses, value.addressId]
  );

  // Auto-select the matched address from search, then the default address.
  useEffect(() => {
    if (editingAddressId) return;
    if (!patientId) return;
    if (value.addressId) return;
    if (value.address || value.city || value.postalCode) return;

    const preferred = preferredAddressId
      ? addresses.find((a) => a.id === preferredAddressId)
      : null;
    const fallback = defaultAddressId
      ? addresses.find((a) => a.id === defaultAddressId)
      : null;
    const address = preferred ?? fallback;

    if (address) onChange(toAddressValue(address));
  }, [
    patientId,
    preferredAddressId,
    defaultAddressId,
    addresses,
    value.addressId,
    value.address,
    value.city,
    value.postalCode,
    editingAddressId,
    onChange,
  ]);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setEditingAddressId(null);
    setDraft(EMPTY_ADDRESS);
    setSaveError("");
    onEditingSavedAddressChange?.(false);
    if (id === NEW_ADDRESS) {
      onChange(EMPTY_ADDRESS);
      return;
    }
    const a = addresses.find((x) => x.id === id);
    if (a) {
      onChange(toAddressValue(a));
    }
  };

  const startEdit = () => {
    if (!value.addressId) return;
    setDraft(value);
    setEditingAddressId(value.addressId);
    setSaveError("");
    onEditingSavedAddressChange?.(true);
  };

  const cancelEdit = () => {
    setEditingAddressId(null);
    setDraft(EMPTY_ADDRESS);
    setSaveError("");
    onEditingSavedAddressChange?.(false);
  };

  const updateAddressField = (field: keyof Omit<AddressValue, "addressId">, text: string) => {
    if (editingAddressId) {
      setDraft((current) => ({ ...current, [field]: text }));
      return;
    }

    onChange({ ...value, [field]: text });
  };

  const saveEdit = async () => {
    if (!patientId || !editingAddressId) return;
    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch(
        `/api/${storeSlug}/patients/${patientId}/addresses/${editingAddressId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: selectedAddress?.label ?? "Saved",
            address: draft.address,
            city: draft.city,
            postalCode: draft.postalCode,
            isDefault: selectedAddress?.isDefault,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError(body?.error || "Failed to save address");
        return;
      }

      const updated = (await res.json()) as SavedAddress;
      onChange(toAddressValue(updated));
      await refresh();
      cancelEdit();
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !value.addressId || !!editingAddressId;
  const showPicker = !!patientId && addresses.length > 0;
  const displayValue = editingAddressId ? draft : value;

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
      {loading && patientId && (
        <p className="text-xs text-slate-500">Loading saved addresses...</p>
      )}

      <div>
        <label className={label}>Delivery Address *</label>
        <input
          required
          value={displayValue.address}
          readOnly={!isEditing}
          onChange={(e) => updateAddressField("address", e.target.value)}
          className={cn(input, !isEditing && inputReadOnly)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={label}>City *</label>
          <input
            required
            value={displayValue.city}
            readOnly={!isEditing}
            onChange={(e) => updateAddressField("city", e.target.value)}
            className={cn(input, !isEditing && inputReadOnly)}
          />
        </div>
        <div>
          <label className={label}>Postal Code *</label>
          <input
            required
            value={displayValue.postalCode}
            readOnly={!isEditing}
            onChange={(e) => updateAddressField("postalCode", e.target.value)}
            className={cn(input, !isEditing && inputReadOnly)}
          />
        </div>
      </div>

      {value.addressId && !editingAddressId && (
        <button type="button" onClick={startEdit} className={softButton}>
          Edit saved address
        </button>
      )}

      {editingAddressId && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className={primaryButton}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className={secondaryButton}
          >
            Cancel
          </button>
          {saveError && <span className="text-sm text-rose-700">{saveError}</span>}
        </div>
      )}

      {!value.addressId && !editingAddressId && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={saveToPatient}
            onChange={(e) => onSaveToPatientChange(e.target.checked)}
            className="rounded border-slate-300 text-[#6f8f72] focus:ring-[#6f8f72]"
          />
          <span>Save this address for future orders</span>
        </label>
      )}
    </div>
  );
}

export const AddressSelect = memo(AddressSelectInner);
