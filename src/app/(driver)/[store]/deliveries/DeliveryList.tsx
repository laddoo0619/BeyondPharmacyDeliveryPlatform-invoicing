"use client";

import { useState } from "react";
import Link from "next/link";
import PickUpButton from "./PickUpButton";
import BatchDeliverButton from "./BatchDeliverButton";
import { cardInteractive, emptyState, input, primaryButtonFull, statusBadgeClasses } from "@/lib/portalStyles";

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
  isToday,
  eligibleForBatchDeliver,
}: {
  deliveries: SerializedDelivery[];
  storeSlug: string;
  selectedDate: string;
  isToday: boolean;
  eligibleForBatchDeliver: number;
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
        className={`${cardInteractive} p-4`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-navy truncate">
              {delivery.patientName}
            </p>
            <p className="text-sm text-muted mt-1 break-words">
              {delivery.deliveryAddress}
            </p>
            <p className="text-sm text-muted">
              {delivery.deliveryCity}, {delivery.deliveryPostalCode}
            </p>
            {delivery.instructions && (
              <p className="text-sm text-navy mt-1">
                Note: {delivery.instructions}
              </p>
            )}
            {delivery.status === "FAILED" && delivery.failedReason && (
              <p className="text-sm text-danger mt-1 font-semibold">
                Failed: {delivery.failedReason}
              </p>
            )}
            {isFromPreviousDay && (
              <p className="text-xs text-navy mt-1">
                From {new Date(delivery.scheduledDate).toLocaleDateString()}
              </p>
            )}
            {delivery.attemptCount > 1 && (
              <p className="text-xs text-muted mt-1">
                Attempt #{delivery.attemptCount}
              </p>
            )}
          </div>
          <span className={statusBadgeClasses(delivery.status)}>
            {delivery.status === "FAILED"
              ? "FAILED"
              : delivery.status.replace("_", " ")}
          </span>
        </div>

        {delivery.status === "FAILED" && (
          <Link
            href={`/${storeSlug}/deliver/${delivery.id}`}
            className="mt-3 block w-full rounded-full border-[1.5px] border-control bg-butter py-3.5 text-center text-sm font-bold text-navy transition duration-[220ms] ease-out hover:border-control-hover active:scale-[0.97]"
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
            className={`${primaryButtonFull} mt-3 block text-center`}
          >
            {delivery.status === "PICKED_UP"
              ? "Start Delivery"
              : "Complete Delivery"}
          </Link>
        )}

        {delivery.status === "DELIVERED" && delivery.completedAt && (
          <p className="mt-2 text-xs text-navy font-semibold">
            Delivered at{" "}
            {new Date(delivery.completedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    );
  };

  return (
    <div>
      {isToday && eligibleForBatchDeliver > 0 && (
        <BatchDeliverButton
          storeSlug={storeSlug}
          eligibleCount={eligibleForBatchDeliver}
        />
      )}

      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, address..."
          aria-label="Search deliveries"
          className={`${input} pr-10`}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-colors duration-[220ms] hover:text-navy text-lg"
          >
            &times;
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={emptyState}>
          {search ? "No matching deliveries found." : <>No orders <span className="italic text-navy">scheduled</span> for this date.</>}
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
            <div className={`${emptyState} mb-4`}>
              All deliveries <span className="italic text-navy">completed</span>!
            </div>
          )}

          {active.length === 0 && delivered.length > 0 && search && (
            <div className={`${emptyState} mb-4`}>
              No matching active deliveries.
            </div>
          )}

          {/* Delivered section */}
          {delivered.length > 0 && (
            <div className={active.length > 0 ? "mt-6" : ""}>
              <button
                onClick={() => setShowDelivered(!showDelivered)}
                aria-expanded={showDelivered}
                className="w-full flex items-center justify-between px-4 py-3 bg-mint rounded-row text-sm font-bold text-navy transition duration-[220ms] active:scale-[0.99]"
              >
                <span className="flex items-center gap-2">
                  <span className="text-navy">&#10003;</span>
                  Delivered ({delivered.length})
                </span>
                <span className="text-navy">
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
