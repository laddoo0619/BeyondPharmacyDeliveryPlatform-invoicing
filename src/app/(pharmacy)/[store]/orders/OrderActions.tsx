"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { input } from "@/lib/portalStyles";

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
  currentDriverId: string | null;
  cancelledAt: string | null;
  storeSlug: string;
  drivers: { id: string; name: string }[];
}

export default function OrderActions({
  orderId,
  currentStatus,
  currentDriverId,
  cancelledAt,
  storeSlug,
  drivers,
}: OrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState("");
  const [canPurge, setCanPurge] = useState(false);

  // Countdown timer for cancelled orders
  useEffect(() => {
    if (currentStatus !== "CANCELLED" || !cancelledAt) return;

    const update = () => {
      const elapsed = Date.now() - new Date(cancelledAt).getTime();
      if (elapsed >= COOLDOWN_MS) {
        setCanPurge(true);
        setRemaining("");
        return false; // stop interval
      }
      const left = COOLDOWN_MS - elapsed;
      const h = Math.floor(left / (1000 * 60 * 60));
      const m = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
      setRemaining(`${h}h ${m}m`);
      setCanPurge(false);
      return true; // keep interval
    };

    if (!update()) return;
    const interval = setInterval(() => {
      if (!update()) clearInterval(interval);
    }, 60_000); // update every minute
    return () => clearInterval(interval);
  }, [currentStatus, cancelledAt]);

  const updateOrder = async (data: Record<string, string>) => {
    setLoading(true);
    await fetch(`/api/${storeSlug}/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    router.refresh();
  };

  const deleteOrder = async () => {
    if (
      currentStatus === "CANCELLED" &&
      canPurge &&
      !confirm("This will permanently delete the order. This action cannot be undone. Continue?")
    ) {
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/${storeSlug}/orders/${orderId}`, {
      method: "DELETE",
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete order");
    }

    router.refresh();
  };

  // Cancelled order — show countdown or permanent delete button
  if (currentStatus === "CANCELLED") {
    return (
      <div className="flex items-center space-x-2">
        {canPurge ? (
          <button
            onClick={deleteOrder}
            disabled={loading}
            className="text-xs bg-rose-600 text-white px-2 py-1 rounded-full hover:bg-rose-700 font-semibold disabled:opacity-50"
          >
            {loading ? "Deleting..." : "Permanent Delete"}
          </button>
        ) : (
          <span className="text-xs text-slate-500">
            Delete in {remaining}
          </span>
        )}
      </div>
    );
  }

  // No actions for in-progress or completed orders
  if (currentStatus === "DELIVERED" || currentStatus === "PICKED_UP" || currentStatus === "IN_TRANSIT") {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      {currentStatus === "PENDING" && (
        <select
          className={`${input} text-xs py-1`}
          value={currentDriverId || ""}
          disabled={loading}
          onChange={(e) => {
            if (e.target.value) {
              updateOrder({
                assignedDriverId: e.target.value,
                status: "ASSIGNED",
              });
            }
          }}
        >
          <option value="">Assign Driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={deleteOrder}
        disabled={loading}
        className="text-xs text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
