"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>
      )}
      <button
        onClick={handlePickUp}
        disabled={loading}
        className="mt-3 block w-full text-center bg-teal-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? "Updating..." : "\u2713 Mark as Picked Up"}
      </button>
    </div>
  );
}
