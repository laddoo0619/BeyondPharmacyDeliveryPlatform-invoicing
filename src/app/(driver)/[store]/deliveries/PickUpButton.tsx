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

  const handlePickUp = async () => {
    setLoading(true);
    await fetch(`/api/${storeSlug}/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PICKED_UP" }),
    });
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handlePickUp}
      disabled={loading}
      className="mt-3 block w-full text-center bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
    >
      {loading ? "Updating..." : "\u2713 Mark as Picked Up"}
    </button>
  );
}
