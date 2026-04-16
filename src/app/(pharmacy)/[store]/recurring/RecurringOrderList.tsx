"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

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
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");
  const [activeDriverFilter, setActiveDriverFilter] = useState<string>(ALL);

  const driverCounts = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: orders.length, [UNASSIGNED]: 0 };
    for (const d of drivers) counts[d.id] = 0;
    for (const o of orders) {
      const key = o.assignedDriverId ?? UNASSIGNED;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [orders, drivers]);

  const visibleOrders = useMemo(() => {
    if (activeDriverFilter === ALL) return orders;
    if (activeDriverFilter === UNASSIGNED) {
      return orders.filter((o) => !o.assignedDriverId);
    }
    return orders.filter((o) => o.assignedDriverId === activeDriverFilter);
  }, [orders, activeDriverFilter]);

  const generateToday = async () => {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await fetch(`/api/${storeSlug}/recurring/generate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGenerateMsg(
          data.created > 0
            ? `${data.created} order${data.created === 1 ? "" : "s"} generated for today.`
            : "Today\u2019s orders have already been generated."
        );
        router.refresh();
      } else {
        setGenerateMsg("Failed to generate orders.");
      }
    } catch {
      setGenerateMsg("Network error. Please try again.");
    }
    setGenerating(false);
  };

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
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurring Orders</h2>
        <div className="flex items-center gap-3">
          {generateMsg && (
            <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">{generateMsg}</span>
          )}
          <button
            onClick={generateToday}
            disabled={generating}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border text-blue-700 border-blue-300 hover:bg-blue-50 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Today\u2019s Orders"}
          </button>
        </div>
      </div>
      <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-2">
        <DriverTab
          label="All"
          count={driverCounts[ALL]}
          active={activeDriverFilter === ALL}
          onClick={() => setActiveDriverFilter(ALL)}
        />
        <DriverTab
          label="Unassigned"
          count={driverCounts[UNASSIGNED] ?? 0}
          active={activeDriverFilter === UNASSIGNED}
          onClick={() => setActiveDriverFilter(UNASSIGNED)}
        />
        {drivers.map((d) => (
          <DriverTab
            key={d.id}
            label={d.name}
            count={driverCounts[d.id] ?? 0}
            active={activeDriverFilter === d.id}
            onClick={() => setActiveDriverFilter(d.id)}
          />
        ))}
      </div>
      {visibleOrders.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500">
          {orders.length === 0
            ? "No recurring orders configured."
            : "No recurring orders for this driver."}
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {visibleOrders.map((order) => (
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

function DriverTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
      }`}
    >
      {label} <span className={active ? "opacity-80" : "text-gray-500"}>({count})</span>
    </button>
  );
}
