"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  card,
  cn,
  emptyState,
  input,
  linkButton,
  sectionTitle,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";

interface Zone {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  defaultDriverId: string | null;
}

interface Driver {
  id: string;
  name: string;
}

export default function ZoneList({ zones, storeSlug, drivers }: { zones: Zone[]; storeSlug: string; drivers: Driver[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const updateZone = async (id: string, data: Record<string, unknown>) => {
    setLoading(true);
    await fetch(`/api/${storeSlug}/zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    setEditingId(null);
    router.refresh();
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-hairline">
        <h2 className={sectionTitle}>Delivery Zones</h2>
      </div>
      {zones.length === 0 ? (
        <div className={cn(emptyState, "m-4")}>
          No delivery zones <span className="italic text-navy">configured</span> yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={tableHeader}>
              <tr>
                <th className="px-6 py-3">Zone</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Default Driver</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {zones.map((zone) => (
                <tr key={zone.id} className={tableRow}>
                <td className="px-6 py-4 text-sm font-semibold text-navy">{zone.name}</td>
                <td className="px-6 py-4 text-sm">
                  {editingId === zone.id ? (
                    <div className="flex items-center space-x-2">
                      <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} aria-label={`Price for ${zone.name}`} className={`${input} w-24 py-1 tabular-nums`} />
                      <button onClick={() => updateZone(zone.id, { price: parseFloat(editPrice) })} disabled={loading} className={cn(linkButton, "text-xs")}>Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-muted transition-colors duration-(--hover-ms) hover:text-navy">Cancel</button>
                    </div>
                  ) : (
                    <span className="font-semibold text-navy tabular-nums">${zone.price.toFixed(2)}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <select
                    value={zone.defaultDriverId || ""}
                    onChange={(e) => updateZone(zone.id, { defaultDriverId: e.target.value || null })}
                    disabled={loading}
                    aria-label={`Default driver for ${zone.name}`}
                    className={`${input} py-1`}
                  >
                    <option value="">None (manual)</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <span className={statusBadgeClasses(zone.isActive ? "ACTIVE" : "INACTIVE")}>
                    {zone.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button onClick={() => { setEditingId(zone.id); setEditPrice(zone.price.toString()); }} className={cn(linkButton, "text-xs")}>Edit Price</button>
                  <button onClick={() => updateZone(zone.id, { isActive: !zone.isActive })} disabled={loading} className="text-muted transition-colors duration-(--hover-ms) hover:text-navy text-xs font-semibold disabled:opacity-50">
                    {zone.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
