"use client";

import { useCallback, useEffect, useState } from "react";

interface Duplicate {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  city: string;
  postalCode: string;
  createdAt: string;
  orderCount: number;
  dispatchCount: number;
  lastActivity: string | null;
  activeRecurring: Array<{ id: string; deliveryAddress: string; deliveryCity: string; days: string }>;
  phoneConflict: boolean;
  sameAddressAsThisPatient: boolean;
}

interface MergeResult {
  moved: {
    orders: number;
    recurringProfiles: number;
    dispatches: number;
    addressesMoved: number;
    addressesReused: number;
  };
  activeRecurringProfiles: number;
  recurringNotAtCurrentAddress: Array<{
    id: string;
    deliveryAddress: string;
    deliveryCity: string;
    days: string;
  }>;
}

interface CurrentAddress {
  address: string;
  city: string;
  postalCode: string;
}

interface Props {
  storeSlug: string;
  patientId: string;
  onMerged: () => Promise<void> | void;
}

function formatDay(iso: string, utc: boolean) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    // Delivery dates are stored as UTC-midnight day keys; render them as the
    // day they name rather than shifting into the browser's timezone.
    ...(utc ? { timeZone: "UTC" } : {}),
  });
}

export function DuplicatePatientsNotice({ storeSlug, patientId, onMerged }: Props) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MergeResult | null>(null);
  const [current, setCurrent] = useState<CurrentAddress | null>(null);
  // The merged record's address, for the result message.
  const [mergedAddress, setMergedAddress] = useState("");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/${storeSlug}/patients/${patientId}/duplicates`, { signal });
        if (!res.ok) {
          setDuplicates([]);
          return;
        }
        const body = await res.json();
        setDuplicates(Array.isArray(body?.duplicates) ? body.duplicates : []);
        setCurrent(body?.current ?? null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setDuplicates([]);
      }
    },
    [storeSlug, patientId]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const merge = async (duplicate: Duplicate) => {
    const deliveries = duplicate.orderCount + duplicate.dispatchCount;
    const phoneWarning = duplicate.phoneConflict
      ? "\n\n⚠ The phone numbers are different — make sure this is the same person."
      : "";
    // Say which address stays the default: staff can pick either record first,
    // so the merge direction must never be a surprise.
    const defaultLine = current
      ? `\n\nDefault address stays: ${current.address}, ${current.city}.\n${duplicate.address}, ${duplicate.city} will be added as a saved address.`
      : "";
    if (
      !confirm(
        `Merge this record into the patient you selected?\n\n${duplicate.name} — ${duplicate.address}, ${duplicate.city}${defaultLine}\n\nIts ${deliveries} deliver${deliveries === 1 ? "y" : "ies"} and ${duplicate.activeRecurring.length} active recurring profile${duplicate.activeRecurring.length === 1 ? "" : "s"} move to the selected patient, and the duplicate record is removed. This can't be undone.${phoneWarning}`
      )
    ) {
      return;
    }

    setBusyId(duplicate.id);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/${storeSlug}/patients/${patientId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePatientId: duplicate.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Merge failed. Please try again.");
        return;
      }
      setMergedAddress(`${duplicate.address}, ${duplicate.city}`);
      setResult(body as MergeResult);
      await Promise.all([load(), onMerged()]);
    } catch {
      setError("Network error — the merge may not have completed. Refresh to check.");
    } finally {
      setBusyId(null);
    }
  };

  if (duplicates.length === 0 && !result && !error) return null;

  return (
    <div className="space-y-3">
      {result && (
        <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Records merged.</p>
          <p>
            Moved {result.moved.orders + result.moved.dispatches} deliveries and{" "}
            {result.moved.recurringProfiles} recurring profile
            {result.moved.recurringProfiles === 1 ? "" : "s"}.
            {result.moved.addressesMoved > 0 &&
              ` ${mergedAddress} is now a saved address on this patient. If that's where they live now, click “Make default” under Manage saved addresses; if it's an old address, delete it there.`}
          </p>
          {result.recurringNotAtCurrentAddress.map((profile) => (
            <p key={profile.id} className="font-semibold text-amber-800">
              ⚠ A recurring profile ({profile.days}) still delivers to {profile.deliveryAddress},{" "}
              {profile.deliveryCity}. If they&apos;ve moved, update it on the Recurring page.
            </p>
          ))}
          {result.activeRecurringProfiles > 1 && (
            <p className="text-amber-800">
              This patient now has {result.activeRecurringProfiles} active recurring profiles — check
              the Recurring page for duplicates.
            </p>
          )}
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 text-sm text-amber-900">
          <div className="px-4 pt-3">
            <p className="font-semibold">
              {duplicates.length === 1
                ? "There is another record under this name"
                : `There are ${duplicates.length} other records under this name`}
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Usually the same person re-entered after a move. Merging moves that record&apos;s
              deliveries, recurring profiles and address onto the patient you selected — nothing
              is lost.
            </p>
          </div>
          <div className="mt-2 divide-y divide-amber-200/70 border-t border-amber-200/70">
            {duplicates.map((duplicate) => (
              <div
                key={duplicate.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{duplicate.name}</p>
                  <p className="text-slate-600">
                    {duplicate.address}, {duplicate.city} {duplicate.postalCode}
                    {duplicate.sameAddressAsThisPatient && (
                      <span className="ml-1 text-xs text-slate-500">(same address)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {duplicate.phone ? `${duplicate.phone} · ` : ""}added{" "}
                    {formatDay(duplicate.createdAt, false)} ·{" "}
                    {duplicate.orderCount + duplicate.dispatchCount} deliveries
                    {duplicate.lastActivity
                      ? `, last ${formatDay(duplicate.lastActivity, true)}`
                      : ""}
                  </p>
                  {duplicate.activeRecurring.map((profile) => (
                    <p key={profile.id} className="text-xs text-slate-600">
                      Active recurring ({profile.days}) to {profile.deliveryAddress},{" "}
                      {profile.deliveryCity}
                    </p>
                  ))}
                  {duplicate.phoneConflict && (
                    <p className="mt-1 text-xs font-semibold text-rose-700">
                      Different phone number — check this is the same person before merging.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => merge(duplicate)}
                  disabled={busyId !== null}
                  className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  {busyId === duplicate.id ? "Merging..." : "Merge into this patient"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
