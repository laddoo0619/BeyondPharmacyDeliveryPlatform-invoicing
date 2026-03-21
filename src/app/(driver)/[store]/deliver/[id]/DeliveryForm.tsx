"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeliveryForm({
  orderId,
  currentStatus,
  attemptCount,
  storeSlug,
}: {
  orderId: string;
  currentStatus: string;
  attemptCount: number;
  storeSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [showFailForm, setShowFailForm] = useState(false);
  const [failReason, setFailReason] = useState("");

  const updateStatus = async (status: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/${storeSlug}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update status");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
      setLoading(false);
      throw err;
    }
    setLoading(false);
  };

  const markDelivered = async () => {
    if (!photo) {
      setError("Please take a photo as proof of delivery");
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (photo.size > MAX_FILE_SIZE) {
      setError("Photo is too large (max 10MB). Please try a smaller photo.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", photo);
      formData.append("orderId", orderId);
      formData.append("notes", notes);

      const uploadRes = await fetch(`/api/${storeSlug}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => null);
        throw new Error(data?.error || "Failed to upload proof of delivery");
      }

      const statusRes = await fetch(`/api/${storeSlug}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      });

      if (!statusRes.ok) {
        throw new Error("Photo uploaded but failed to mark as delivered. Please try again.");
      }

      router.push(`/${storeSlug}/deliveries`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
      setLoading(false);
    }
  };

  const markFailed = async () => {
    if (!failReason.trim()) {
      setError("Please provide a reason for the failed delivery");
      return;
    }
    setError("");
    try {
      await updateStatus("FAILED", { failedReason: failReason.trim() });
      router.push(`/${storeSlug}/deliveries`);
      router.refresh();
    } catch {
      // error already set by updateStatus
    }
  };

  // FAILED order — show re-attempt button
  if (currentStatus === "FAILED") {
    return (
      <div className="space-y-3">
        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
        )}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-800">
            Previous attempt failed
          </p>
          <p className="text-sm text-red-600 mt-1">
            Attempt #{attemptCount} — tap below to re-attempt delivery
          </p>
        </div>
        <button
          onClick={() => updateStatus("IN_TRANSIT").catch(() => {})}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Starting..." : "Re-attempt Delivery"}
        </button>
      </div>
    );
  }

  // ASSIGNED — mark as picked up
  if (currentStatus === "ASSIGNED") {
    return (
      <div>
        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm mb-3">{error}</div>
        )}
        <button
          onClick={() => updateStatus("PICKED_UP").catch(() => {})}
          disabled={loading}
          className="w-full bg-teal-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Updating..." : "\u2713 Mark as Picked Up"}
        </button>
      </div>
    );
  }

  // PICKED_UP — start delivery
  if (currentStatus === "PICKED_UP") {
    return (
      <div>
        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm mb-3">{error}</div>
        )}
        <button
          onClick={() => updateStatus("IN_TRANSIT").catch(() => {})}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Start Delivery (Mark In Transit)"}
        </button>
      </div>
    );
  }

  // IN_TRANSIT — complete or fail
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {attemptCount > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700 font-medium">
            Re-attempt #{attemptCount}
          </p>
        </div>
      )}

      {!showFailForm ? (
        <>
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
            className="w-full bg-green-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Completing..." : "Mark as Delivered"}
          </button>

          <button
            onClick={() => setShowFailForm(true)}
            className="w-full bg-red-50 text-red-700 border border-red-200 py-3.5 rounded-lg text-sm font-medium hover:bg-red-100"
          >
            Failed Delivery
          </button>
        </>
      ) : (
        <div className="bg-white rounded-lg p-4 border border-red-200">
          <h3 className="text-sm font-semibold text-red-800 mb-3">
            Report Failed Delivery
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <select
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select a reason...</option>
                <option value="No one home">No one home</option>
                <option value="Wrong address">Wrong address</option>
                <option value="Patient refused delivery">Patient refused delivery</option>
                <option value="Unable to access location">Unable to access location</option>
                <option value="Unsafe conditions">Unsafe conditions</option>
              </select>
            </div>
            <textarea
              value={failReason.startsWith("Other:") ? failReason.slice(7) : ""}
              onChange={(e) =>
                setFailReason(e.target.value ? `Other: ${e.target.value}` : failReason)
              }
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Or type a custom reason..."
            />

            <div className="flex space-x-3">
              <button
                onClick={markFailed}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Confirm Failed"}
              </button>
              <button
                onClick={() => {
                  setShowFailForm(false);
                  setFailReason("");
                  setError("");
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
