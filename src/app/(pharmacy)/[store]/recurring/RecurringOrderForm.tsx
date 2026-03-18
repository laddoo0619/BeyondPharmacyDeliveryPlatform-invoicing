"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Zone {
  id: string;
  name: string;
  price: number;
}

interface Patient {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  city: string;
  postalCode: string;
}

export default function RecurringOrderForm({ zones, storeSlug }: { zones: Zone[]; storeSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);

  // Patient search state
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  // Form field state (auto-filled from patient or manually entered)
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");

  const searchPatients = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setPatients([]);
        setShowDropdown(false);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/${storeSlug}/patients?search=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          setPatients(data);
          setShowDropdown(data.length > 0);
        }
      } finally {
        setSearchLoading(false);
      }
    },
    [storeSlug]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectedPatient) return; // Don't search if patient is already selected
    debounceRef.current = setTimeout(() => searchPatients(patientSearch), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [patientSearch, selectedPatient, searchPatients]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setPatientName(patient.name);
    setPatientPhone(patient.phone || "");
    setDeliveryAddress(patient.address);
    setDeliveryCity(patient.city);
    setDeliveryPostalCode(patient.postalCode);
    setShowDropdown(false);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientName("");
    setPatientPhone("");
    setDeliveryAddress("");
    setDeliveryCity("");
    setDeliveryPostalCode("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (selectedDays.length === 0) {
      setError("Select at least one delivery day");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/${storeSlug}/recurring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: selectedPatient?.id || null,
        patientName: patientName || formData.get("patientName"),
        patientPhone: patientPhone || formData.get("patientPhone"),
        deliveryAddress: deliveryAddress || formData.get("deliveryAddress"),
        deliveryCity: deliveryCity || formData.get("deliveryCity"),
        deliveryPostalCode: deliveryPostalCode || formData.get("deliveryPostalCode"),
        deliveryZoneId: formData.get("deliveryZoneId"),
        instructions: formData.get("instructions"),
        activeDays: selectedDays,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create");
    } else {
      (e.target as HTMLFormElement).reset();
      setSelectedDays([1]);
      clearPatient();
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">New Recurring Order</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

        {/* Patient search with typeahead */}
        <div ref={dropdownRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          {selectedPatient ? (
            <div className="flex items-center justify-between px-3 py-2 border rounded-lg bg-blue-50 border-blue-200">
              <div>
                <span className="text-sm font-medium text-blue-900">{selectedPatient.name}</span>
                <span className="text-xs text-blue-600 ml-2">{selectedPatient.address}, {selectedPatient.city}</span>
              </div>
              <button type="button" onClick={clearPatient} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setPatientName(e.target.value);
                }}
                placeholder="Search patients or type new name..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
              {searchLoading && (
                <div className="absolute right-3 top-9 text-xs text-gray-400">Searching...</div>
              )}
              {showDropdown && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.address}, {p.city} {p.postalCode}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden inputs for form data when patient is selected */}
        <input type="hidden" name="patientName" value={patientName} />
        <input type="hidden" name="patientPhone" value={patientPhone} />

        {!selectedPatient && (
          <input
            name="patientPhoneVisible"
            value={patientPhone}
            onChange={(e) => setPatientPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        )}

        <input
          name="deliveryAddress"
          required
          placeholder="Address"
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="deliveryCity"
            required
            placeholder="City"
            value={deliveryCity}
            onChange={(e) => setDeliveryCity(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            name="deliveryPostalCode"
            required
            placeholder="Postal Code"
            value={deliveryPostalCode}
            onChange={(e) => setDeliveryPostalCode(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select name="deliveryZoneId" required className="w-full px-3 py-2 border rounded-lg text-sm">
          <option value="">Select zone...</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name} — ${z.price.toFixed(2)}</option>
          ))}
        </select>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, i) => (
              <label key={i} className={`flex items-center px-3 py-1.5 border rounded-lg text-sm cursor-pointer ${selectedDays.includes(i) ? "bg-blue-100 border-blue-400 text-blue-800" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedDays.includes(i)}
                  onChange={() => {
                    setSelectedDays((prev) =>
                      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()
                    );
                  }}
                />
                {day}
              </label>
            ))}
          </div>
        </div>
        <textarea name="instructions" rows={2} placeholder="Instructions (optional)" className="w-full px-3 py-2 border rounded-lg text-sm" />
        <button type="submit" disabled={loading || selectedDays.length === 0} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Creating..." : "Create Recurring Order"}
        </button>
      </form>
    </div>
  );
}
