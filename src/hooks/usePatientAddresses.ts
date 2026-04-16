"use client";

import { useCallback, useEffect, useState } from "react";

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
}

export function usePatientAddresses(storeSlug: string, patientId: string | null) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/${storeSlug}/patients/${patientId}/addresses`);
      if (res.ok) {
        setAddresses(await res.json());
      } else {
        setAddresses([]);
      }
    } finally {
      setLoading(false);
    }
  }, [storeSlug, patientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { addresses, loading, refresh: load };
}
