"use client";

import { useState } from "react";
import OrderActions from "./OrderActions";
import {
  card,
  sectionTitle,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";

interface SerializedOrder {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  scheduledDate: string;
  deliveryZoneName: string;
  priceAtCreation: number;
  status: string;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  cancelledAt: string | null;
  createdAt: string;
  isExternal: boolean;
  externalProvider: string | null;
}

interface OrdersListProps {
  groupedOrders: Record<string, SerializedOrder[]>;
  sortedDateKeys: string[];
  storeSlug: string;
  drivers: { id: string; name: string }[];
  statusColors: Record<string, string>;
}

function formatDateHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function OrdersList({
  groupedOrders,
  sortedDateKeys,
  storeSlug,
  drivers,
  statusColors,
}: OrdersListProps) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(
    () => new Set(sortedDateKeys)
  );

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {sortedDateKeys.map((dateKey) => {
        const orders = groupedOrders[dateKey];
        const isExpanded = expandedDays.has(dateKey);

        return (
          <div key={dateKey} className={`${card} overflow-hidden`}>
            {/* Accordion Header */}
            <button
              onClick={() => toggleDay(dateKey)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-sky-50/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <svg
                  className={`h-5 w-5 text-[#6f8f72] transition-transform duration-200 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className={sectionTitle}>
                  {formatDateHeading(dateKey)}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#1e3a8a] bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-100">
                {orders.length} {orders.length === 1 ? "order" : "orders"}
              </span>
            </button>

            {/* Accordion Body */}
            {isExpanded && (
              <div className="border-t overflow-x-auto">
                <table className="w-full">
                  <thead className={tableHeader}>
                    <tr>
                      <th className="px-6 py-3">Patient</th>
                      <th className="px-6 py-3">Address</th>
                      <th className="px-6 py-3">Zone</th>
                      <th className="px-6 py-3">Price</th>
                      <th className="px-6 py-3">Driver</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className={tableRow}>
                        <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">{order.patientName}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{order.deliveryAddress}, {order.deliveryCity}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{order.deliveryZoneName}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">${order.priceAtCreation.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          <span>{order.assignedDriverName || "Unassigned"}</span>
                          {order.isExternal && (
                            <span className="ml-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                              {order.externalProvider}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={statusColors[order.status] || statusBadgeClasses(order.status)}>
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {order.isExternal ? (
                            <span className="text-xs font-semibold text-slate-500">
                              External handoff
                            </span>
                          ) : (
                            <OrderActions
                              orderId={order.id}
                              currentStatus={order.status}
                              currentDriverId={order.assignedDriverId}
                              cancelledAt={order.cancelledAt}
                              storeSlug={storeSlug}
                              drivers={drivers}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
