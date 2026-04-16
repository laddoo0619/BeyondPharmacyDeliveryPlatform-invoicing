"use client";

import { useMemo, useState } from "react";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-teal-100 text-teal-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

interface Driver {
  id: string;
  name: string;
}

interface TodayOrder {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  status: string;
  failedReason: string | null;
  priceAtCreation: number;
}

export default function TodayDeliveriesTable({
  orders,
  drivers,
}: {
  orders: TodayOrder[];
  drivers: Driver[];
}) {
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

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Today&apos;s Deliveries</h2>
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
            ? "No deliveries scheduled for today."
            : "No deliveries for this driver today."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className={`hover:bg-gray-50 ${order.status === "FAILED" ? "bg-red-50" : ""}`}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.patientName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {order.deliveryAddress}, {order.deliveryCity}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {order.assignedDriverName || "Unassigned"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        statusColors[order.status] || "bg-gray-100"
                      }`}
                    >
                      {order.status.replace("_", " ")}
                    </span>
                    {order.status === "FAILED" && order.failedReason && (
                      <p className="text-xs text-red-600 mt-1">{order.failedReason}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${order.priceAtCreation.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
