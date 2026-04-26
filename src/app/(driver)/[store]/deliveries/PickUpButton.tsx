"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonFull } from "@/lib/portalStyles";

export default function PickUpButton({
  orderId,
  storeSlug,
}: {
  orderId: string;
  storeSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePickUp = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${storeSlug}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PICKED_UP" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update status");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <p className="mt-2 text-xs text-rose-600 font-semibold">{error}</p>
      )}
      <button
        onClick={handlePickUp}
        disabled={loading}
        className={`${primaryButtonFull} mt-3 block text-center`}
      >
        {loading ? "Updating..." : "\u2713 Mark as Picked Up"}
      </button>
    </div>
  );
}
