"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
  currentDriverId: string | null;
  drivers: { id: string; name: string }[];
}

export default function OrderActions({
  orderId,
  currentStatus,
  currentDriverId,
  drivers,
}: OrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateOrder = async (data: Record<string, string>) => {
    setLoading(true);
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    router.refresh();
  };

  if (currentStatus === "DELIVERED" || currentStatus === "CANCELLED") {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      {currentStatus === "PENDING" && (
        <select
          className="text-xs border rounded px-2 py-1"
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
      {currentStatus !== "CANCELLED" && (
        <button
          onClick={() => updateOrder({ status: "CANCELLED" })}
          disabled={loading}
          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
