"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Driver {
  id: string;
  name: string;
}

interface RecurringOrderItem {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  zoneName: string;
  zonePrice: number;
  activeDays: number[];
  isActive: boolean;
  isOnHold: boolean;
  holdStart: string | null;
  holdEnd: string | null;
  isSkippedThisWeek: boolean;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
}

export default function RecurringOrderList({
  orders,
  drivers,
  storeSlug,
}: {
  orders: RecurringOrderItem[];
  drivers: Driver[];
  storeSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const toggleHold = async (id: string, isOnHold: boolean) => {
    if (!isOnHold) {
      // Prompt for dates — use simple prompt for now (frontend already has date pickers)
      const holdStart = prompt("Hold start date (YYYY-MM-DD):");
      if (!holdStart) return;
      const holdEnd = prompt("Hold end date (YYYY-MM-DD):");
      if (!holdEnd) return;

      setLoading(id);
      await fetch(`/api/${storeSlug}/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnHold: true, holdStart, holdEnd }),
      });
    } else {
      setLoading(id);
      await fetch(`/api/${storeSlug}/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnHold: false }),
      });
    }
    setLoading(null);
    router.refresh();
  };

  const toggleSkip = async (id: string, currentlySkipped: boolean) => {
    setLoading(id);
    if (currentlySkipped) {
      await fetch(`/api/${storeSlug}/recurring/${id}/unskip`, { method: "POST" });
    } else {
      await fetch(`/api/${storeSlug}/recurring/${id}/skip`, { method: "POST" });
    }
    setLoading(null);
    router.refresh();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setLoading(id);
    await fetch(`/api/${storeSlug}/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setLoading(null);
    router.refresh();
  };

  const reassignDriver = async (id: string, assignedDriverId: string | null) => {
    setLoading(id);
    await fetch(`/api/${storeSlug}/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedDriverId }),
    });
    setLoading(null);
    router.refresh();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recurring order? This cannot be undone. Existing delivery records will be preserved.")) {
      return;
    }
    setLoading(id);
    await fetch(`/api/${storeSlug}/recurring/${id}`, { method: "DELETE" });
    setLoading(null);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Recurring Orders</h2>
      </div>
      {orders.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500">No recurring orders configured.</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {orders.map((order) => (
            <div key={order.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{order.patientName}</p>
                <p className="text-sm text-gray-500">{order.deliveryAddress}, {order.deliveryCity}</p>
                <p className="text-sm text-gray-500">{order.zoneName} — ${order.zonePrice.toFixed(2)} • Every {order.activeDays.map((d) => DAYS[d]).join(", ")}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">Driver:</span>
                  <select
                    value={order.assignedDriverId || ""}
                    onChange={(e) => reassignDriver(order.id, e.target.value || null)}
                    disabled={loading === order.id}
                    className="text-xs border rounded px-2 py-1 text-gray-700 disabled:opacity-50"
                  >
                    <option value="">Zone default</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {order.isOnHold && (
                  <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                    On Hold {order.holdStart && order.holdEnd
                      ? `${new Date(order.holdStart).toLocaleDateString()} – ${new Date(order.holdEnd).toLocaleDateString()}`
                      : ""}
                  </span>
                )}
                {order.isSkippedThisWeek && !order.isOnHold && (
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full font-medium">Skipped this week</span>
                )}
                {!order.isActive && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full font-medium">Inactive</span>
                )}
                {order.isActive && (
                  <button onClick={() => toggleHold(order.id, order.isOnHold)} disabled={loading === order.id}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${order.isOnHold ? "text-green-700 border-green-300 hover:bg-green-50" : "text-purple-700 border-purple-300 hover:bg-purple-50"} disabled:opacity-50`}>
                    {order.isOnHold ? "Remove Hold" : "Vacation Hold"}
                  </button>
                )}
                {order.isActive && !order.isOnHold && (
                  <button onClick={() => toggleSkip(order.id, order.isSkippedThisWeek)} disabled={loading === order.id}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${order.isSkippedThisWeek ? "text-green-700 border-green-300 hover:bg-green-50" : "text-orange-700 border-orange-300 hover:bg-orange-50"} disabled:opacity-50`}>
                    {order.isSkippedThisWeek ? "Unskip" : "Skip This Week"}
                  </button>
                )}
                <button onClick={() => toggleActive(order.id, order.isActive)} disabled={loading === order.id}
                  className="text-xs text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50">
                  {order.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => deleteOrder(order.id)} disabled={loading === order.id}
                  className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
