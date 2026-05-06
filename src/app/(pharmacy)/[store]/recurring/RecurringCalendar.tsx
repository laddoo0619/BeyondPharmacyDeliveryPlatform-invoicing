"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  card,
  cn,
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
  generatedOrderStatus: string | null;
}

interface CalendarResponse {
  instances: CalendarInstance[];
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function getCalendarRange(month: Date) {
  const start = monthStart(month);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = addDays(start, 42);
  return { start, end };
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function isSameMonth(day: Date, month: Date) {
  return (
    day.getUTCFullYear() === month.getUTCFullYear() &&
    day.getUTCMonth() === month.getUTCMonth()
  );
}

export default function RecurringCalendar({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [instances, setInstances] = useState<CalendarInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyInstance, setBusyInstance] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const { start, end } = useMemo(
    () => getCalendarRange(visibleMonth),
    [visibleMonth]
  );

  const days = useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(start, index)),
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

  const showMonth = (month: Date) => {
    setLoading(true);
    setError("");
    setVisibleMonth(month);
  };

  const toggleInstanceHold = async (instance: CalendarInstance) => {
    if (instance.holdType === "TEMPLATE") return;

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
          reason: "Held from recurring calendar",
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Failed to update calendar hold");
    } else {
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
          <p className="text-sm text-slate-500">{formatMonth(visibleMonth)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => showMonth(addMonths(visibleMonth, -1))}
            className={`${secondaryButton} px-3 py-1.5 text-xs`}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => showMonth(monthStart(new Date()))}
            className={`${primaryButton} px-3 py-1.5 text-xs`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => showMonth(addMonths(visibleMonth, 1))}
            className={`${secondaryButton} px-3 py-1.5 text-xs`}
          >
            Next
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
              className={cn(
                "min-h-36 border-b border-slate-100 p-2 sm:border-r",
                !isSameMonth(day, visibleMonth) && "bg-slate-50/70 text-slate-400"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1e3a8a]">
                  {day.getUTCDate()}
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
                <div className="space-y-1.5">
                  {dayInstances.map((instance) => {
                    const isBusy = busyInstance === instance.id;
                    const isTemplateHold = instance.holdType === "TEMPLATE";

                    return (
                      <button
                        key={instance.id}
                        type="button"
                        disabled={isBusy || isTemplateHold}
                        onClick={() => toggleInstanceHold(instance)}
                        className={cn(
                          "w-full rounded-xl border px-2 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-70",
                          instance.isHeld
                            ? "border-violet-200 bg-violet-50 text-violet-800"
                            : "border-emerald-100 bg-white text-slate-600 hover:border-[#6f8f72]/40 hover:bg-emerald-50/70"
                        )}
                      >
                        <span className="block truncate font-semibold text-[#1e3a8a]">
                          {instance.patientName}
                        </span>
                        <span className="block truncate text-slate-500">
                          {instance.deliveryCity} • {instance.zoneName}
                        </span>
                        <span className="mt-1 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-slate-200">
                          {isBusy
                            ? "Updating"
                            : isTemplateHold
                              ? "Vacation hold"
                              : instance.isHeld
                                ? "Resume"
                                : "Hold"}
                        </span>
                        {instance.generatedOrderStatus && (
                          <span className="ml-1 mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-100">
                            {instance.generatedOrderStatus.replace("_", " ")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
