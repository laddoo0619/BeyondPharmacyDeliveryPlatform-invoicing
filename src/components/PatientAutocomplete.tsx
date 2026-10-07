"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { usePatientSearch, type Patient } from "@/hooks/usePatientSearch";
import { cn, input, inputReadOnly, label, textLink } from "@/lib/portalStyles";

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
  const inputId = useId();

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
      <label htmlFor={inputId} className={label}>Patient Name *</label>
      <div className="flex">
        <input
          id={inputId}
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
            className={cn(textLink, "ml-2 px-3 py-2 text-sm")}
          >
            Change
          </button>
        )}
      </div>
      {loading && !selected && (
        <p className="mt-1 text-xs text-muted">Searching...</p>
      )}
      {open && !selected && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-auto rounded-row border border-hairline bg-white shadow-lift max-h-60">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="row-hover w-full text-left px-3 py-2 border-b border-hairline last:border-b-0"
            >
              <div className="font-semibold text-navy">{p.name}</div>
              <div className="text-xs text-muted">
                {p.matchedAddress
                  ? `${p.matchedAddress.label} — ${p.matchedAddress.address}, ${p.matchedAddress.city} ${p.matchedAddress.postalCode}`
                  : `${p.address}, ${p.city} ${p.postalCode}`}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const PatientAutocomplete = memo(PatientAutocompleteInner);
