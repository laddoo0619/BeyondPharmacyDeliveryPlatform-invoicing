"use client";

import { useState } from "react";
import Link from "next/link";
import PickUpButton from "./PickUpButton";

const statusColors: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-800",
  PICKED_UP: "bg-teal-100 text-teal-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

interface SerializedDelivery {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  instructions: string | null;
  status: string;
  failedReason: string | null;
  attemptCount: number;
  scheduledDate: string;
  completedAt: string | null;
}

export default function DeliveryList({
  deliveries,
  storeSlug,
  selectedDate,
}: {
  deliveries: SerializedDelivery[];
  storeSlug: string;
  selectedDate: string;
}) {
  const [search, setSearch] = useState("");
  const [showDelivered, setShowDelivered] = useState(false);

  const selectedDateObj = new Date(selectedDate + "T00:00:00");

  const filtered = deliveries.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.patientName.toLowerCase().includes(q) ||
      d.deliveryAddress.toLowerCase().includes(q) ||
      d.deliveryCity.toLowerCase().includes(q) ||
      d.deliveryPostalCode.toLowerCase().includes(q)
    );
  });

  const active = filtered.filter((d) => d.status !== "DELIVERED");
  const delivered = filtered.filter((d) => d.status === "DELIVERED");

  const renderCard = (delivery: SerializedDelivery) => {
    const isFromPreviousDay = new Date(delivery.scheduledDate) < selectedDateObj;

    return (
      <div
        key={delivery.id}
        className={`bg-white rounded-lg p-4 border shadow-sm ${
          delivery.status === "FAILED" ? "border-red-300" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">
              {delivery.patientName}
            </p>
            <p className="text-sm text-gray-500 mt-1 break-words">
              {delivery.deliveryAddress}
            </p>
            <p className="text-sm text-gray-500">
              {delivery.deliveryCity}, {delivery.deliveryPostalCode}
            </p>
            {delivery.instructions && (
              <p className="text-sm text-blue-600 mt-1">
                Note: {delivery.instructions}
              </p>
            )}
            {delivery.status === "FAILED" && delivery.failedReason && (
              <p className="text-sm text-red-600 mt-1 font-medium">
                Failed: {delivery.failedReason}
              </p>
            )}
            {isFromPreviousDay && (
              <p className="text-xs text-orange-600 mt-1">
                From {new Date(delivery.scheduledDate).toLocaleDateString()}
              </p>
            )}
            {delivery.attemptCount > 1 && (
              <p className="text-xs text-gray-500 mt-1">
                Attempt #{delivery.attemptCount}
              </p>
            )}
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              statusColors[delivery.status] || "bg-gray-100"
            }`}
          >
            {delivery.status === "FAILED"
              ? "FAILED"
              : delivery.status.replace("_", " ")}
          </span>
        </div>

        {delivery.status === "FAILED" && (
          <Link
            href={`/${storeSlug}/deliver/${delivery.id}`}
            className="mt-3 block w-full text-center bg-orange-500 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            Re-attempt Delivery
          </Link>
        )}

        {delivery.status === "ASSIGNED" && (
          <PickUpButton orderId={delivery.id} storeSlug={storeSlug} />
        )}

        {(delivery.status === "PICKED_UP" ||
          delivery.status === "IN_TRANSIT") && (
          <Link
            href={`/${storeSlug}/deliver/${delivery.id}`}
            className="mt-3 block w-full text-center bg-green-600 text-white py-3.5 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            {delivery.status === "PICKED_UP"
              ? "Start Delivery"
              : "Complete Delivery"}
          </Link>
        )}

        {delivery.status === "DELIVERED" && delivery.completedAt && (
          <p className="mt-2 text-xs text-green-600 font-medium">
            Delivered at{" "}
            {new Date(delivery.completedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, address..."
          className="w-full px-4 py-2.5 pr-10 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
          >
            &times;
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border">
          {search ? "No matching deliveries found." : "No orders scheduled for this date."}
        </div>
      ) : (
        <>
          {/* Active deliveries section */}
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map(renderCard)}
            </div>
          )}

          {active.length === 0 && delivered.length > 0 && !search && (
            <div className="bg-white rounded-lg p-6 text-center text-gray-500 border mb-4">
              All deliveries completed!
            </div>
          )}

          {active.length === 0 && delivered.length > 0 && search && (
            <div className="bg-white rounded-lg p-6 text-center text-gray-500 border mb-4">
              No matching active deliveries.
            </div>
          )}

          {/* Delivered section */}
          {delivered.length > 0 && (
            <div className={active.length > 0 ? "mt-6" : ""}>
              <button
                onClick={() => setShowDelivered(!showDelivered)}
                className="w-full flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm font-semibold text-green-800 hover:bg-green-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-green-600">&#10003;</span>
                  Delivered ({delivered.length})
                </span>
                <span className="text-green-600">
                  {showDelivered ? "\u25B2" : "\u25BC"}
                </span>
              </button>

              {showDelivered && (
                <div className="space-y-3 mt-3">
                  {delivered.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
