"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { primaryButton } from "@/lib/portalStyles";
import { isFridgeReminderDue } from "@/lib/fridgeSchedule";
import { vancouverTodayKey } from "@/lib/vancouverDate";

interface FridgeChecklistItem {
  id: string;
  kind: "ORDER" | "DISPATCH";
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  fridgeItemNote: string | null;
  checkedAt: string | null;
  isExternal: boolean;
}

interface FridgeChecklist {
  dateKey: string;
  items: FridgeChecklistItem[];
  outstanding: number;
}

const SNOOZE_MINUTES = 30;
const POLL_MS = 60_000;

// Per-browser, per-day so a dismissal never silently carries into tomorrow.
function snoozeKey(storeSlug: string, dateKey: string) {
  return `fridge-snooze:${storeSlug}:${dateKey}`;
}

function readSnoozedUntil(storeSlug: string, dateKey: string) {
  try {
    const raw = window.localStorage.getItem(snoozeKey(storeSlug, dateKey));
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Private mode / blocked storage: treat as never snoozed. Nagging is the
    // safe failure for a missed medication.
    return 0;
  }
}

function writeSnoozedUntil(storeSlug: string, dateKey: string, until: number) {
  try {
    window.localStorage.setItem(snoozeKey(storeSlug, dateKey), String(until));
  } catch {
    // Ignore — the reminder simply stays visible.
  }
}

export default function FridgeReminder({ storeSlug }: { storeSlug: string }) {
  const [checklist, setChecklist] = useState<FridgeChecklist | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const snoozeRef = useRef(() => {});
  // Bumped on every tick so a poll that started earlier can't overwrite the
  // fresher state it doesn't know about.
  const mutationSeq = useRef(0);

  const fetchChecklist = useCallback(async () => {
    const seq = mutationSeq.current;
    try {
      const res = await fetch(`/api/${storeSlug}/fridge`);
      if (!res.ok) return;
      const data = await res.json();
      // A tick landed while this poll was in flight — its response already
      // carries newer state, so drop this one.
      if (mutationSeq.current !== seq) return;
      setChecklist(data);
    } catch {
      // Offline or transient — keep whatever list we already have.
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchChecklist();
    const interval = setInterval(() => {
      setNow(new Date());
      fetchChecklist();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchChecklist]);

  const dateKey = checklist?.dateKey ?? vancouverTodayKey(now);

  useEffect(() => {
    setSnoozedUntil(readSnoozedUntil(storeSlug, dateKey));
  }, [storeSlug, dateKey]);

  const toggleItem = async (item: FridgeChecklistItem) => {
    mutationSeq.current += 1;
    setSaving(item.id);
    setError("");
    try {
      const res = await fetch(`/api/${storeSlug}/fridge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          kind: item.kind,
          checked: !item.checkedAt,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Could not save — try again.");
        return;
      }

      setChecklist(await res.json());
    } catch {
      setError("Network error — the item was not saved.");
    } finally {
      setSaving(null);
    }
  };

  const hideUntil = (until: number) => {
    writeSnoozedUntil(storeSlug, dateKey, until);
    setSnoozedUntil(until);
  };

  const snooze = () => hideUntil(Date.now() + SNOOZE_MINUTES * 60_000);

  // Explicit "not happening today" escape hatch. Keyed to today's dateKey, so
  // tomorrow starts fresh no matter how long this timestamp runs.
  const dismissForToday = () => hideUntil(Date.now() + 24 * 60 * 60_000);

  snoozeRef.current = snooze;

  const outstanding = checklist?.outstanding ?? 0;
  const visible =
    outstanding > 0 && isFridgeReminderDue(now) && Date.now() >= snoozedUntil;

  // Bound to `visible`: a listener that lives while the popup is hidden turns
  // every Escape elsewhere in the portal (ConfirmModal uses the same key) into
  // a silent 30-minute snooze of a reminder the user never saw.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") snoozeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible || !checklist || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={snooze} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_24px_70px_rgba(30,58,138,0.2)] mx-4">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xl">
              🧊
            </span>
            <h3 className="text-lg font-bold text-[#1e3a8a]">
              Fridge items to pull today
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {outstanding} {outstanding === 1 ? "delivery needs" : "deliveries need"} a
            refrigerated item. Tick each one as you add it to the bag.
          </p>
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {checklist.items.map((item) => {
            const checked = !!item.checkedAt;
            return (
              <label
                key={`${item.kind}:${item.id}`}
                className={`flex cursor-pointer items-start gap-3 px-6 py-3 transition hover:bg-sky-50/60 ${
                  checked ? "opacity-55" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving === item.id}
                  onChange={() => toggleItem(item)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-[#6f8f72] focus:ring-[#6f8f72]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-semibold text-slate-800 ${
                        checked ? "line-through" : ""
                      }`}
                    >
                      {item.patientName}
                    </span>
                    {item.isExternal && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        Anchor
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">
                    {item.deliveryAddress}, {item.deliveryCity}
                  </span>
                  {item.fridgeItemNote && (
                    <span className="mt-0.5 block text-sm font-medium text-[#6f8f72]">
                      {item.fridgeItemNote}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {error && (
          <div className="border-t border-rose-100 bg-rose-50 px-6 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={dismissForToday}
            className="text-xs font-semibold text-slate-500 transition hover:text-[#1e3a8a]"
            title="Hides the reminder until tomorrow, even with items still unticked."
          >
            Not today — dismiss
          </button>
          <button onClick={snooze} className={primaryButton}>
            Remind me in {SNOOZE_MINUTES} min
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
