"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, emptyState, sectionTitle } from "@/lib/portalStyles";

interface ReminderView {
  id: string;
  note: string;
  patientName: string | null;
  remindOn: string;
  repeatIntervalWeeks: number | null;
  completedAt: string | null;
  isOverdue: boolean;
}

function formatDay(dateKey: string) {
  // Render the stored UTC-midnight key as the day it names, without letting the
  // browser's timezone shift it backwards.
  return new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function repeatLabel(weeks: number | null) {
  if (!weeks) return null;
  return weeks === 1 ? "weekly" : `every ${weeks} weeks`;
}

export default function ReminderList({
  storeSlug,
  reminders,
}: {
  storeSlug: string;
  reminders: ReminderView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const open = reminders.filter((r) => !r.completedAt);
  const done = reminders.filter((r) => r.completedAt).slice(0, 25);

  const act = async (id: string, run: () => Promise<Response>) => {
    setBusy(id);
    setError("");
    try {
      const res = await run();
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Action failed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const setCompleted = (id: string, completed: boolean) =>
    act(id, () =>
      fetch(`/api/${storeSlug}/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      })
    );

  const remove = (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    return act(id, () =>
      fetch(`/api/${storeSlug}/reminders/${id}`, { method: "DELETE" })
    );
  };

  const row = (r: ReminderView) => (
    <div
      key={r.id}
      className="flex flex-wrap items-start justify-between gap-3 px-6 py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-semibold ${
              r.completedAt ? "text-slate-400 line-through" : "text-slate-800"
            }`}
          >
            {r.note}
          </span>
          {r.isOverdue && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              Overdue
            </span>
          )}
          {r.repeatIntervalWeeks && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
              Repeats {repeatLabel(r.repeatIntervalWeeks)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {formatDay(r.remindOn)}
          {r.patientName ? ` — ${r.patientName}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCompleted(r.id, !r.completedAt)}
          disabled={busy === r.id}
          className="text-xs font-semibold text-[#6f8f72] transition hover:text-[#5f7d62] disabled:opacity-50"
        >
          {r.completedAt ? "Reopen" : "Mark done"}
        </button>
        <button
          onClick={() => remove(r.id)}
          disabled={busy === r.id}
          className="text-xs font-semibold text-rose-600 transition hover:text-rose-800 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className={card}>
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className={sectionTitle}>Upcoming ({open.length})</h2>
        </div>
        {open.length === 0 ? (
          <div className={emptyState}>
            No <span className="italic text-[#1e3a8a]">reminders</span> scheduled
          </div>
        ) : (
          <div className="divide-y divide-slate-100">{open.map(row)}</div>
        )}
      </div>

      {done.length > 0 && (
        <div className={card}>
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className={sectionTitle}>Recently completed</h2>
          </div>
          <div className="divide-y divide-slate-100">{done.map(row)}</div>
        </div>
      )}
    </div>
  );
}
