"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { primaryButton } from "@/lib/portalStyles";
import { isReminderDue } from "@/lib/reminderSchedule";
import { vancouverTodayKey } from "@/lib/vancouverDate";

interface ReminderItem {
  id: string;
  note: string;
  patientName: string | null;
  remindOn: string;
  repeatIntervalWeeks: number | null;
  isOverdue: boolean;
}

interface DueReminders {
  dateKey: string;
  items: ReminderItem[];
  outstanding: number;
}

const SNOOZE_MINUTES = 30;
const POLL_MS = 60_000;

// Per-browser, per-day so a dismissal never silently carries into tomorrow.
function snoozeKey(storeSlug: string, dateKey: string) {
  return `reminder-snooze:${storeSlug}:${dateKey}`;
}

function readSnoozedUntil(storeSlug: string, dateKey: string) {
  try {
    const raw = window.localStorage.getItem(snoozeKey(storeSlug, dateKey));
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Blocked storage: treat as never snoozed. Nagging is the safe failure.
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

export default function ReminderPopup({ storeSlug }: { storeSlug: string }) {
  const [due, setDue] = useState<DueReminders | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const snoozeRef = useRef(() => {});
  // Bumped on every tick so a poll that started earlier can't overwrite the
  // fresher state it doesn't know about.
  const mutationSeq = useRef(0);

  const fetchDue = useCallback(async () => {
    const seq = mutationSeq.current;
    try {
      const res = await fetch(`/api/${storeSlug}/reminders?scope=due`);
      if (!res.ok) return;
      const data = await res.json();
      if (mutationSeq.current !== seq) return;
      setDue(data);
    } catch {
      // Offline or transient — keep whatever we already have.
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchDue();
    const interval = setInterval(() => {
      setNow(new Date());
      fetchDue();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchDue]);

  const dateKey = due?.dateKey ?? vancouverTodayKey(now);

  useEffect(() => {
    setSnoozedUntil(readSnoozedUntil(storeSlug, dateKey));
  }, [storeSlug, dateKey]);

  const complete = async (item: ReminderItem) => {
    mutationSeq.current += 1;
    setSaving(item.id);
    setError("");
    try {
      const res = await fetch(`/api/${storeSlug}/reminders/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Could not save — try again.");
        return;
      }
      await fetchDue();
    } catch {
      setError("Network error — that reminder was not marked done.");
    } finally {
      setSaving(null);
    }
  };

  const hideUntil = (until: number) => {
    writeSnoozedUntil(storeSlug, dateKey, until);
    setSnoozedUntil(until);
  };
  const snooze = () => hideUntil(Date.now() + SNOOZE_MINUTES * 60_000);
  // Keyed to today's dateKey, so tomorrow starts fresh regardless.
  const dismissForToday = () => hideUntil(Date.now() + 24 * 60 * 60_000);

  snoozeRef.current = snooze;

  const outstanding = due?.outstanding ?? 0;
  const visible =
    outstanding > 0 && isReminderDue(now) && Date.now() >= snoozedUntil;

  // Bound to `visible`: a listener that lives while the popup is hidden turns
  // every Escape elsewhere in the portal into a silent snooze of a reminder
  // the user never saw.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") snoozeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible || !due || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={snooze} />
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_24px_70px_rgba(30,58,138,0.2)]">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-xl">
              🔔
            </span>
            <h3 className="text-lg font-bold text-[#1e3a8a]">Reminders for today</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {outstanding} {outstanding === 1 ? "reminder" : "reminders"} outstanding.
            Tick each one off as you handle it.
          </p>
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {due.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 px-6 py-3">
              <button
                onClick={() => complete(item)}
                disabled={saving === item.id}
                title="Mark done"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border border-slate-300 transition hover:border-[#6f8f72] hover:bg-[#6f8f72]/10 disabled:opacity-40"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800">{item.note}</span>
                  {item.isOverdue && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      Overdue
                    </span>
                  )}
                </div>
                {item.patientName && (
                  <span className="mt-0.5 block truncate text-sm text-slate-500">
                    {item.patientName}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="border-t border-rose-100 bg-rose-50 px-6 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={dismissForToday}
              className="text-xs font-semibold text-slate-500 transition hover:text-[#1e3a8a]"
              title="Hides these until tomorrow, even if still outstanding."
            >
              Not today — dismiss
            </button>
            <Link
              href={`/${storeSlug}/reminders`}
              onClick={snooze}
              className="text-xs font-semibold text-slate-500 transition hover:text-[#1e3a8a]"
            >
              Manage
            </Link>
          </div>
          <button onClick={snooze} className={primaryButton}>
            Remind me in {SNOOZE_MINUTES} min
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
