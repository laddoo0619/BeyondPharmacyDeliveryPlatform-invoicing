"use client";

import { memo, useEffect, useRef, useState } from "react";
import { usePatientSearch, type Patient } from "@/hooks/usePatientSearch";

interface Props {
  storeSlug: string;
  selected: Patient | null;
  onSelect: (p: Patient) => void;
  onClear: () => void;
  onFreeTextChange: (name: string) => void;
}

function PatientAutocompleteInner({
  storeSlug,
  selected,
  onSelect,
  onClear,
  onFreeTextChange,
}: Props) {
  const { query, setQuery, results, loading, selectPatient } = usePatientSearch(storeSlug);
  const [dismissed, setDismissed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDismissed(true);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const open = !dismissed && !selected && results.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDismissed(false);
    setQuery(v);
    onFreeTextChange(v);
  };

  const handleSelect = (p: Patient) => {
    selectPatient(p);
    onSelect(p);
    setDismissed(true);
  };

  const handleClear = () => {
    setQuery("");
    setDismissed(false);
    onClear();
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
      <div className="flex">
        <input
          type="text"
          required
          value={selected ? selected.name : query}
          onChange={handleChange}
          onFocus={() => setDismissed(false)}
          readOnly={!!selected}
          placeholder="Start typing to search..."
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${selected ? "bg-gray-50" : ""}`}
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Change
          </button>
        )}
      </div>
      {loading && !selected && (
        <p className="mt-1 text-xs text-gray-500">Searching…</p>
      )}
      {open && !selected && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-500">
                {p.address}, {p.city} {p.postalCode}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const PatientAutocomplete = memo(PatientAutocompleteInner);
