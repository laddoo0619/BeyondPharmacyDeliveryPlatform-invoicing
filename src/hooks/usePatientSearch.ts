"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Patient {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  city: string;
  postalCode: string;
  matchedAddressId?: string | null;
  matchedAddress?: {
    id: string;
    label: string;
    address: string;
    city: string;
    postalCode: string;
    isDefault: boolean;
  } | null;
}

export function usePatientSearch(storeSlug: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/${storeSlug}/patients?search=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          setResults(await res.json());
        }
      } finally {
        setLoading(false);
      }
    },
    [storeSlug]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selected) return;
    const q = query;
    debounceRef.current = setTimeout(() => run(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, run]);

  const selectPatient = useCallback((p: Patient) => {
    setSelected(p);
    setQuery(p.name);
    setResults([]);
  }, []);

  const clearPatient = useCallback(() => {
    setSelected(null);
    setQuery("");
    setResults([]);
  }, []);

  return { query, setQuery, results, loading, selected, selectPatient, clearPatient };
}
