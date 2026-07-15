"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface CreateOrderInput {
  patientId: string | null;
  patientName: string;
  patientPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryAddressId: string | null;
  saveAddressToPatient: boolean;
  deliveryZoneId: string;
  assignedDriverId: string | null;
  instructions: string;
  scheduledDate: string;
}

export function useCreateOrder(storeSlug: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const submit = useCallback(
    async (input: CreateOrderInput) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setError("");
      setLoading(true);

      try {
        const res = await fetch(`/api/${storeSlug}/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey.current,
          },
          body: JSON.stringify({
            idempotencyKey: idempotencyKey.current,
            patientId: input.patientId ?? undefined,
            patientName: input.patientName,
            patientPhone: input.patientPhone,
            deliveryAddress: input.deliveryAddress,
            deliveryCity: input.deliveryCity,
            deliveryPostalCode: input.deliveryPostalCode,
            deliveryAddressId: input.deliveryAddressId ?? undefined,
            saveAddressToPatient: input.saveAddressToPatient,
            deliveryZoneId: input.deliveryZoneId,
            assignedDriverId: input.assignedDriverId ?? undefined,
            instructions: input.instructions,
            scheduledDate: input.scheduledDate,
          }),
        });

        if (res.ok) {
          // Deliberately keep loading/inFlight set: navigation to the orders
          // page is still in flight, and re-arming the button in that window
          // is how a same-tab double submission mints a duplicate delivery.
          // The server-side duplicate check is the backstop for other tabs.
          router.push(`/${storeSlug}/orders`);
          return;
        }

        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Failed to create order");

        // On validation failure the old key wasn't consumed by a row, but
        // semantically the user is submitting a new intent after editing.
        // Regenerate so a corrected retry is a fresh request.
        if (res.status >= 400 && res.status < 500) {
          idempotencyKey.current = crypto.randomUUID();
        }
      } catch {
        setError("Network error — please try again");
        // Network errors keep the same key so a retry dedupes server-side.
      }

      inFlight.current = false;
      setLoading(false);
    },
    [storeSlug, router]
  );

  return { submit, loading, error };
}
