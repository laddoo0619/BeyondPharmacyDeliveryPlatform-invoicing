"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  card,
  cn,
  input,
  label,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from "@/lib/portalStyles";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarInstance {
  id: string;
  recurringOrderId: string;
  date: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  zoneName: string;
  assignedDriverName: string | null;
  isHeld: boolean;
  holdType: "INSTANCE" | "TEMPLATE" | null;
  skipDate: string | null;
  holdReason: string | null;
  generatedOrderStatus: string | null;
}

interface CalendarResponse {
  instances: CalendarInstance[];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function weekStart(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function getCalendarRange(week: Date) {
  const start = weekStart(week);
  const end = addDays(start, 7);
  return { start, end };
}

function formatWeekRange(start: Date, end: Date) {
  const rangeEnd = addDays(end, -1);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel = rangeEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startLabel} - ${endLabel}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function RecurringCalendar({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [visibleWeek, setVisibleWeek] = useState(() => weekStart(new Date()));
  const [instances, setInstances] = useState<CalendarInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyInstance, setBusyInstance] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] =
    useState<CalendarInstance | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [holdReasonDraft, setHoldReasonDraft] = useState("");

  const { start, end } = useMemo(
    () => getCalendarRange(visibleWeek),
    [visibleWeek]
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(start, index)),
    [start]
  );

  const instancesByDate = useMemo(() => {
    const map = new Map<string, CalendarInstance[]>();
    for (const instance of instances) {
      const current = map.get(instance.date) ?? [];
      current.push(instance);
      map.set(instance.date, current);
    }
    return map;
  }, [instances]);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      start: dateKey(start),
      end: dateKey(end),
    });

    fetch(`/api/${storeSlug}/recurring/calendar?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as CalendarResponse & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || "Failed to load recurring calendar");
        }
        setInstances(body.instances ?? []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load recurring calendar");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [end, refreshToken, start, storeSlug]);

  const showWeek = (week: Date) => {
    setLoading(true);
    setError("");
    setVisibleWeek(weekStart(week));
  };

  const toggleInstanceHold = async (instance: CalendarInstance) => {
    if (instance.holdType === "TEMPLATE") return;

    const holding = !instance.isHeld;
    const reason = holdReasonDraft.trim();
    if (holding && !reason) {
      setError("Enter a reason for the hold.");
      return;
    }

    setBusyInstance(instance.id);
    setError("");

    const action = instance.isHeld ? "unskip" : "skip";
    const res = await fetch(
      `/api/${storeSlug}/recurring/${instance.recurringOrderId}/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skipDate: instance.isHeld && instance.skipDate ? instance.skipDate : instance.date,
          ...(holding ? { reason } : {}),
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to update calendar hold");
    } else {
      setSelectedInstance({
        ...instance,
        isHeld: holding,
        holdType: holding ? "INSTANCE" : null,
        skipDate: holding ? instance.date : null,
        holdReason: holding ? reason : null,
      });
      setHoldReasonDraft("");
      setLoading(true);
      setRefreshToken((value) => value + 1);
      router.refresh();
    }

    setBusyInstance(null);
  };

  const deleteRecurringProfile = async (instance: CalendarInstance) => {
    if (
      !confirm(
        "Delete this recurring profile? Existing delivery records will be preserved."
      )
    ) {
      return;
    }

    setBusyInstance(instance.id);
    setError("");

    const res = await fetch(
      `/api/${storeSlug}/recurring/${instance.recurringOrderId}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to delete recurring profile");
    } else {
      setSelectedInstance(null);
      setLoading(true);
      setRefreshToken((value) => value + 1);
      router.refresh();
    }

    setBusyInstance(null);
  };

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={sectionTitle}>Recurring Calendar</h2>
          <p className="text-sm text-slate-500">{formatWeekRange(start, end)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => showWeek(addDays(visibleWeek, -7))}
            className={`${secondaryButton} px-3 py-1.5 text-xs`}
          >
            Previous Week
          </button>
          <button
            type="button"
            onClick={() => showWeek(new Date())}
            className={`${primaryButton} px-3 py-1.5 text-xs`}
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => showWeek(addDays(visibleWeek, 7))}
            className={`${secondaryButton} px-3 py-1.5 text-xs`}
          >
            Next Week
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b bg-rose-50 px-6 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-7 border-b bg-gradient-to-r from-sky-50/80 to-emerald-50/70">
        {DAY_LABELS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const dayInstances = instancesByDate.get(key) ?? [];

          return (
            <div
              key={key}
              className="min-h-48 border-b border-slate-100 p-2 sm:border-r"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1e3a8a]">
                  {formatDayLabel(day)}
                </span>
                {dayInstances.length > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                    {dayInstances.length}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="rounded-xl bg-white/70 px-2 py-2 text-xs text-slate-400">
                  Loading...
                </div>
              ) : (
                <div className="space-y-1">
                  {dayInstances.map((instance) => {
                    const isBusy = busyInstance === instance.id;

                    return (
                      <button
                        key={instance.id}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setHoldReasonDraft("");
                          setSelectedInstance(instance);
                        }}
                        title={
                          instance.isHeld && instance.holdReason
                            ? `On hold: ${instance.holdReason}`
                            : undefined
                        }
                        className={cn(
                          "block w-full truncate rounded-full px-2.5 py-1 text-left text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
                          instance.isHeld
                            ? "bg-red-600 text-white ring-1 ring-inset ring-red-700 hover:bg-red-700"
                            : "bg-white text-[#1e3a8a] ring-1 ring-inset ring-slate-200 hover:bg-emerald-50 hover:ring-[#6f8f72]/40"
                        )}
                      >
                        {isBusy ? "Updating..." : instance.patientName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedInstance && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 px-4 py-6 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-quick-view-title"
          onClick={() => setSelectedInstance(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3
                  id="recurring-quick-view-title"
                  className="text-lg font-bold text-[#1e3a8a]"
                >
                  {selectedInstance.patientName}
                </h3>
                <p className="text-sm text-slate-500">
                  {formatDayLabel(new Date(`${selectedInstance.date}T00:00:00.000Z`))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstance(null)}
                className="rounded-full px-2 py-1 text-sm font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 rounded-2xl bg-slate-50/80 p-4">
              <QuickViewRow
                label="Address"
                value={`${selectedInstance.deliveryAddress}, ${selectedInstance.deliveryCity}`}
              />
              <QuickViewRow label="Zone" value={selectedInstance.zoneName} />
              <QuickViewRow
                label="Driver"
                value={selectedInstance.assignedDriverName ?? "Unassigned"}
              />
              <QuickViewRow
                label="Status"
                value={
                  selectedInstance.holdType === "TEMPLATE"
                    ? "Vacation hold"
                    : selectedInstance.isHeld
                      ? "Hold active"
                      : "Active"
                }
              />
              {selectedInstance.generatedOrderStatus && (
                <QuickViewRow
                  label="Generated order"
                  value={selectedInstance.generatedOrderStatus.replace("_", " ")}
                />
              )}
              {selectedInstance.isHeld && selectedInstance.holdReason && (
                <QuickViewRow
                  label="Hold reason"
                  value={selectedInstance.holdReason}
                />
              )}
            </div>

            {selectedInstance.holdType !== "TEMPLATE" && !selectedInstance.isHeld && (
              <div className="mt-4">
                <label htmlFor="hold-reason" className={label}>
                  Reason for hold
                </label>
                <textarea
                  id="hold-reason"
                  rows={2}
                  value={holdReasonDraft}
                  onChange={(event) => setHoldReasonDraft(event.target.value)}
                  placeholder="e.g. Patient in hospital until next week"
                  className={input}
                />
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {selectedInstance.holdType === "TEMPLATE" ? (
                <span className="rounded-full bg-red-600 px-3 py-2 text-center text-xs font-semibold text-white ring-1 ring-red-700">
                  Vacation hold
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleInstanceHold(selectedInstance)}
                  disabled={
                    busyInstance === selectedInstance.id ||
                    (!selectedInstance.isHeld && !holdReasonDraft.trim())
                  }
                  className={`${secondaryButton} justify-center text-xs`}
                >
                  {busyInstance === selectedInstance.id
                    ? "Updating..."
                    : selectedInstance.isHeld
                      ? "Resume"
                      : "Hold"}
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteRecurringProfile(selectedInstance)}
                disabled={busyInstance === selectedInstance.id}
                className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyInstance === selectedInstance.id ? "Working..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function QuickViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
