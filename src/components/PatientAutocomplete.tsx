"use client";

import { memo, useEffect, useRef, useState } from "react";
import { usePatientSearch, type Patient } from "@/hooks/usePatientSearch";
import { cn, input, inputReadOnly, label } from "@/lib/portalStyles";

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
      <label className={label}>Patient Name *</label>
      <div className="flex">
        <input
          type="text"
          required
          value={selected ? selected.name : query}
          onChange={handleChange}
          onFocus={() => setDismissed(false)}
          readOnly={!!selected}
          placeholder="Start typing to search..."
          className={cn(input, selected && inputReadOnly)}
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 px-3 py-2 text-sm font-semibold text-[#6f8f72] hover:text-[#5f7d62]"
          >
            Change
          </button>
        )}
      </div>
      {loading && !selected && (
        <p className="mt-1 text-xs text-slate-500">Searching...</p>
      )}
      {open && !selected && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-auto rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(30,58,138,0.12)] max-h-60">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 hover:bg-sky-50/70 border-b border-slate-100 last:border-b-0"
            >
              <div className="font-semibold text-[#1e3a8a]">{p.name}</div>
              <div className="text-xs text-slate-500">
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
