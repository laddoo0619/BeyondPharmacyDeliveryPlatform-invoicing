"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function BatchDeliverButton({
  storeSlug,
  eligibleCount,
}: {
  storeSlug: string;
  eligibleCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${storeSlug}/orders/batch-deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to batch deliver orders");
      }
      const data = await res.json();
      setResult(data.updated);
      setShowModal(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      {error && (
        <p className="mb-2 text-xs text-red-600 font-medium">{error}</p>
      )}
      {result !== null && (
        <p className="mb-2 text-xs text-green-600 font-medium">
          {result} order(s) marked as delivered.
        </p>
      )}
      <button
        onClick={() => {
          setResult(null);
          setShowModal(true);
        }}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-indigo-700"
      >
        Batch Deliver All ({eligibleCount})
      </button>
      <ConfirmModal
        open={showModal}
        title="Batch Deliver All Orders"
        message={`Mark all ${eligibleCount} eligible order(s) as delivered? This cannot be undone.`}
        confirmLabel="Deliver All"
        confirmClassName="bg-green-600 hover:bg-green-700"
        onConfirm={handleConfirm}
        onCancel={() => setShowModal(false)}
        loading={loading}
      />
    </div>
  );
}
