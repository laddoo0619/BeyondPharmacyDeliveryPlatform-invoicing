"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeliveryForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const markInTransit = async () => {
    setLoading(true);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_TRANSIT" }),
    });
    router.refresh();
    setLoading(false);
  };

  const markDelivered = async () => {
    if (!photo) {
      setError("Please take a photo as proof of delivery");
      return;
    }

    setError("");
    setLoading(true);

    // Upload photo
    const formData = new FormData();
    formData.append("file", photo);
    formData.append("orderId", orderId);
    formData.append("notes", notes);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setError("Failed to upload proof of delivery");
      setLoading(false);
      return;
    }

    // Update order status
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DELIVERED" }),
    });

    router.push("/deliveries");
    router.refresh();
  };

  if (currentStatus === "ASSIGNED") {
    return (
      <button
        onClick={markInTransit}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Updating..." : "Start Delivery (Mark In Transit)"}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg p-4 border">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Proof of Delivery Photo *
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          className="w-full text-sm"
        />
        {photo && (
          <p className="mt-1 text-xs text-green-600">
            Photo selected: {photo.name}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg p-4 border">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Delivery Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          placeholder="Left at front door, etc."
        />
      </div>

      <button
        onClick={markDelivered}
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Completing..." : "Mark as Delivered"}
      </button>
    </div>
  );
}
