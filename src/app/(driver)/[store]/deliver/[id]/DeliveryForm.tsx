"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  card,
  input,
  label,
  primaryButtonFull,
  secondaryButton,
  dangerButton,
} from "@/lib/portalStyles";

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
    setError("");
    try {
      await updateStatus("DELIVERED");
      router.push(`/${storeSlug}/deliveries`);
      router.refresh();
    } catch {
      // error already set by updateStatus
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
          <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm">{error}</div>
        )}
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-rose-800">
            Previous attempt failed
          </p>
          <p className="text-sm text-rose-600 mt-1">
            Attempt #{attemptCount} — tap below to re-attempt delivery
          </p>
        </div>
        <button
          onClick={() => updateStatus("IN_TRANSIT").catch(() => {})}
          disabled={loading}
          className={primaryButtonFull}
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
          <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm mb-3">{error}</div>
        )}
        <button
          onClick={() => updateStatus("PICKED_UP").catch(() => {})}
          disabled={loading}
          className={primaryButtonFull}
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
          <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm mb-3">{error}</div>
        )}
        <button
          onClick={() => updateStatus("IN_TRANSIT").catch(() => {})}
          disabled={loading}
          className={primaryButtonFull}
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
        <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm">
          {error}
        </div>
      )}

      {attemptCount > 1 && (
        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-3">
          <p className="text-sm text-[#1e3a8a] font-semibold">
            Re-attempt #{attemptCount}
          </p>
        </div>
      )}

      {!showFailForm ? (
        <>
          <div className={`${card} p-4`}>
            <label className={label}>
              Delivery Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={input}
              placeholder="Left at front door, etc."
            />
          </div>

          <button
            onClick={markDelivered}
            disabled={loading}
            className={primaryButtonFull}
          >
            {loading ? "Completing..." : "Mark as Delivered"}
          </button>

          <button
            onClick={() => setShowFailForm(true)}
            className="w-full bg-rose-50 text-rose-700 border border-rose-200 py-3.5 rounded-xl text-sm font-semibold hover:bg-rose-100"
          >
            Failed Delivery
          </button>
        </>
      ) : (
        <div className={`${card} p-4 border-rose-200`}>
          <h3 className="text-sm font-semibold text-rose-800 mb-3">
            Report Failed Delivery
          </h3>
          <div className="space-y-3">
            <div>
              <label className={label}>
                Reason *
              </label>
              <select
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                className={input}
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
              className={input}
              placeholder="Or type a custom reason..."
            />

            <div className="flex space-x-3">
              <button
                onClick={markFailed}
                disabled={loading}
                className={`${dangerButton} flex-1 py-3.5`}
              >
                {loading ? "Submitting..." : "Confirm Failed"}
              </button>
              <button
                onClick={() => {
                  setShowFailForm(false);
                  setFailReason("");
                  setError("");
                }}
                className={`${secondaryButton} flex-1 py-3.5`}
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
