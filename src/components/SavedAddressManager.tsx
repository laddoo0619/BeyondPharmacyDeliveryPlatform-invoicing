"use client";

import { useState } from "react";
import type { SavedAddress } from "@/hooks/usePatientAddresses";
import { getAddressDeletionBlocker } from "@/lib/patientRecords";

interface Props {
  storeSlug: string;
  patientId: string;
  addresses: SavedAddress[];
  onChanged: (deletedAddressId?: string) => Promise<void> | void;
}

export function SavedAddressManager({ storeSlug, patientId, addresses, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [inUse, setInUse] = useState<{ address: SavedAddress; message: string } | null>(null);

  if (addresses.length === 0) return null;

  const base = `/api/${storeSlug}/patients/${patientId}/addresses`;

  const makeDefault = async (address: SavedAddress) => {
    setBusyId(address.id);
    setError("");
    setInUse(null);
    try {
      const res = await fetch(`${base}/${address.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: address.label,
          address: address.address,
          city: address.city,
          postalCode: address.postalCode,
          isDefault: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Could not make this the default address");
        return;
      }
      await onChanged();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (address: SavedAddress, confirmInUse = false) => {
    if (
      !confirmInUse &&
      !confirm(
        `Delete this saved address?\n\n${address.address}, ${address.city} ${address.postalCode}\n\nPast deliveries keep the address they went to — only this saved entry is removed.`
      )
    ) {
      return;
    }

    setBusyId(address.id);
    setError("");
    setInUse(null);
    try {
      const res = await fetch(`${base}/${address.id}${confirmInUse ? "?confirmInUse=1" : ""}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 409 && body?.inUse) {
          setInUse({ address, message: body.error });
          return;
        }
        setError(body?.error || "Could not delete this address");
        return;
      }
      await onChanged(address.id);
    } catch {
      setError("Network error — the address may not have been deleted. Refresh to check.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[#1e3a8a]"
      >
        <span>Manage saved addresses ({addresses.length})</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {addresses.map((address) => {
            const blocker = getAddressDeletionBlocker({
              isDefault: address.isDefault,
              addressCount: addresses.length,
            });
            return (
              <div
                key={address.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold text-slate-700">{address.label}</span>
                  {address.isDefault && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Default
                    </span>
                  )}
                  <span className="block truncate text-slate-500">
                    {address.address}, {address.city} {address.postalCode}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => makeDefault(address)}
                      disabled={busyId !== null}
                      className="text-xs font-semibold text-[#6f8f72] transition hover:text-[#5f7d62] disabled:opacity-50"
                    >
                      Make default
                    </button>
                  )}
                  {blocker === null && (
                    <button
                      type="button"
                      onClick={() => remove(address)}
                      disabled={busyId !== null}
                      className="text-xs font-semibold text-rose-600 transition hover:text-rose-800 disabled:opacity-50"
                    >
                      {busyId === address.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {inUse && (
            <div className="space-y-2 border-t border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p>{inUse.message}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => remove(inUse.address, true)}
                  disabled={busyId !== null}
                  className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  Delete anyway
                </button>
                <button
                  type="button"
                  onClick={() => setInUse(null)}
                  disabled={busyId !== null}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Keep it
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            {addresses.length === 1
              ? "Only one address on file — if they've moved, use “Edit saved address” to update it."
              : "To remove the default address, make another address the default first."}
          </p>
        </div>
      )}
    </div>
  );
}
