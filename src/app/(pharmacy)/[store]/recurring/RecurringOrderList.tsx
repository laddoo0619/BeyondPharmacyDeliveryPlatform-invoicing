"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  card,
  emptyState,
  input,
  primaryButton,
  secondaryButton,
  sectionTitle,
  statusBadgeClasses,
} from "@/lib/portalStyles";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

interface Driver {
  id: string;
  name: string;
}

interface RecurringOrderItem {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
  zoneName: string;
  zonePrice: number;
  activeDays: number[];
  recurrenceIntervalWeeks: number;
  recurrenceAnchorDate: string;
  isActive: boolean;
  isOnHold: boolean;
  holdStart: string | null;
  holdEnd: string | null;
  isSkippedThisWeek: boolean;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
}

function lastNameGroup(patientName: string) {
  const trimmed = patientName.trim();
  if (!trimmed) return "Unknown";

  const group = trimmed.includes(",")
    ? trimmed.split(",")[0]?.trim()
    : trimmed.split(/\s+/)[0]?.trim();

  return group || "Unknown";
}

export default function RecurringOrderList({
  orders,
  drivers,
  storeSlug,
}: {
  orders: RecurringOrderItem[];
  drivers: Driver[];
  storeSlug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");
  const [activeDriverFilter, setActiveDriverFilter] = useState<string>(ALL);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

  const driverCounts = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: orders.length, [UNASSIGNED]: 0 };
    for (const d of drivers) counts[d.id] = 0;
    for (const o of orders) {
      const key = o.assignedDriverId ?? UNASSIGNED;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [orders, drivers]);

  const visibleOrders = useMemo(() => {
    if (activeDriverFilter === ALL) return orders;
    if (activeDriverFilter === UNASSIGNED) {
      return orders.filter((o) => !o.assignedDriverId);
    }
    return orders.filter((o) => o.assignedDriverId === activeDriverFilter);
  }, [orders, activeDriverFilter]);

  const groupedOrders = useMemo(() => {
    const groups = new Map<string, RecurringOrderItem[]>();
    for (const order of visibleOrders) {
      const key = lastNameGroup(order.patientName);
      groups.set(key, [...(groups.get(key) ?? []), order]);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleOrders]);

  const generateToday = async () => {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await fetch(`/api/${storeSlug}/recurring/generate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setGenerateMsg(
          data.message ||
            (data.created > 0
              ? `${data.created} order${data.created === 1 ? "" : "s"} generated for today.`
              : "Today\u2019s orders have already been generated.")
        );
        router.refresh();
      } else {
        setGenerateMsg("Failed to generate orders.");
      }
    } catch {
      setGenerateMsg("Network error. Please try again.");
    }
    setGenerating(false);
  };

  const toggleHold = async (id: string, isOnHold: boolean) => {
    if (!isOnHold) {
      // Prompt for dates — use simple prompt for now (frontend already has date pickers)
      const holdStart = prompt("Hold start date (YYYY-MM-DD):");
      if (!holdStart) return;
      const holdEnd = prompt("Hold end date (YYYY-MM-DD):");
      if (!holdEnd) return;

      setLoading(id);
      await fetch(`/api/${storeSlug}/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnHold: true, holdStart, holdEnd }),
      });
    } else {
      setLoading(id);
      await fetch(`/api/${storeSlug}/recurring/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnHold: false }),
      });
    }
    setLoading(null);
    router.refresh();
  };

  const toggleSkip = async (id: string, currentlySkipped: boolean) => {
    setLoading(id);
    if (currentlySkipped) {
      await fetch(`/api/${storeSlug}/recurring/${id}/unskip`, { method: "POST" });
    } else {
      await fetch(`/api/${storeSlug}/recurring/${id}/skip`, { method: "POST" });
    }
    setLoading(null);
    router.refresh();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setLoading(id);
    await fetch(`/api/${storeSlug}/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setLoading(null);
    router.refresh();
  };

  const reassignDriver = async (id: string, assignedDriverId: string | null) => {
    setLoading(id);
    await fetch(`/api/${storeSlug}/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedDriverId }),
    });
    setLoading(null);
    router.refresh();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recurring order? This cannot be undone. Existing delivery records will be preserved.")) {
      return;
    }
    setLoading(id);
    await fetch(`/api/${storeSlug}/recurring/${id}`, { method: "DELETE" });
    setLoading(null);
    router.refresh();
  };

  const scheduleText = (order: RecurringOrderItem) => {
    const days = order.activeDays.map((d) => DAYS[d]).join(", ");
    if (order.recurrenceIntervalWeeks === 2) {
      return `Every other ${days}`;
    }
    return `Weekly on ${days}`;
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className={sectionTitle}>Recurring Profiles</h2>
        <div className="flex items-center gap-3">
          {generateMsg && (
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full ring-1 ring-emerald-100">{generateMsg}</span>
          )}
          <button
            onClick={generateToday}
            disabled={generating}
            className={`${primaryButton} text-xs py-1.5`}
          >
            {generating ? "Generating..." : "Generate Today\u2019s Orders"}
          </button>
        </div>
      </div>
      <div className="px-6 py-3 border-b bg-gradient-to-r from-sky-50/80 to-emerald-50/70 flex flex-wrap gap-2">
        <DriverTab
          label="All"
          count={driverCounts[ALL]}
          active={activeDriverFilter === ALL}
          onClick={() => setActiveDriverFilter(ALL)}
        />
        <DriverTab
          label="Unassigned"
          count={driverCounts[UNASSIGNED] ?? 0}
          active={activeDriverFilter === UNASSIGNED}
          onClick={() => setActiveDriverFilter(UNASSIGNED)}
        />
        {drivers.map((d) => (
          <DriverTab
            key={d.id}
            label={d.name}
            count={driverCounts[d.id] ?? 0}
            active={activeDriverFilter === d.id}
            onClick={() => setActiveDriverFilter(d.id)}
          />
        ))}
      </div>
      {visibleOrders.length === 0 ? (
        <div className={emptyState}>
          {orders.length === 0
            ? <>No recurring orders <span className="italic text-[#1e3a8a]">configured</span>.</>
            : <>No recurring orders for this <span className="italic text-[#1e3a8a]">driver</span>.</>}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {groupedOrders.map(([group, groupOrders]) => {
            const isExpanded = expandedGroups.has(group);
            const groupId = `recurring-group-${group
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}`;

            return (
              <section key={group}>
                <button
                  type="button"
                  aria-controls={groupId}
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between bg-gradient-to-r from-sky-50/70 to-emerald-50/50 px-6 py-3 text-left transition hover:from-sky-50 hover:to-emerald-50"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-sm text-[#6f8f72] transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    >
                      ›
                    </span>
                    <span className="text-sm font-bold text-[#1e3a8a]">
                      {group}
                    </span>
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                    {groupOrders.length}
                  </span>
                </button>

                {isExpanded && (
                  <div id={groupId} className="divide-y divide-slate-100">
                    {groupOrders.map((order) => (
                      <div key={order.id} className="px-6 py-4 flex flex-col gap-4 hover:bg-sky-50/40 transition-colors sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[#1e3a8a]">{order.patientName}</p>
                          <p className="text-sm text-slate-500">{order.deliveryAddress}, {order.deliveryCity}</p>
                          <p className="text-sm text-slate-500">{order.zoneName} — ${order.zonePrice.toFixed(2)} • {scheduleText(order)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">Driver:</span>
                            <select
                              value={order.assignedDriverId || ""}
                              onChange={(e) => reassignDriver(order.id, e.target.value || null)}
                              disabled={loading === order.id}
                              className={`${input} text-xs py-1`}
                            >
                              <option value="">Zone default</option>
                              {drivers.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {order.isOnHold && (
                            <span className={statusBadgeClasses("HOLD")}>
                              On Hold {order.holdStart && order.holdEnd
                                ? `${new Date(order.holdStart).toLocaleDateString()} – ${new Date(order.holdEnd).toLocaleDateString()}`
                                : ""}
                            </span>
                          )}
                          {order.isSkippedThisWeek && !order.isOnHold && (
                            <span className={statusBadgeClasses("SKIPPED")}>Skipped this week</span>
                          )}
                          {!order.isActive && (
                            <span className={statusBadgeClasses("INACTIVE")}>Inactive</span>
                          )}
                          {order.isActive && (
                            <button onClick={() => toggleHold(order.id, order.isOnHold)} disabled={loading === order.id}
                              className={`${secondaryButton} text-xs py-1.5`}>
                              {order.isOnHold ? "Remove Hold" : "Vacation Hold"}
                            </button>
                          )}
                          {order.isActive && !order.isOnHold && (
                            <button onClick={() => toggleSkip(order.id, order.isSkippedThisWeek)} disabled={loading === order.id}
                              className={`${secondaryButton} text-xs py-1.5`}>
                              {order.isSkippedThisWeek ? "Unskip" : "Skip This Week"}
                            </button>
                          )}
                          <button onClick={() => toggleActive(order.id, order.isActive)} disabled={loading === order.id}
                            className="text-xs text-slate-500 hover:text-[#1e3a8a] font-semibold disabled:opacity-50">
                            {order.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => deleteOrder(order.id)} disabled={loading === order.id}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-50">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DriverTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-[#6f8f72] text-white border-[#6f8f72]"
          : "bg-white text-slate-600 border-slate-200 hover:bg-sky-50"
      }`}
    >
      {label} <span className={active ? "opacity-80" : "text-slate-400"}>({count})</span>
    </button>
  );
}
