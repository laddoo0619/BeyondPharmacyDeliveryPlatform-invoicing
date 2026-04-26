"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, input, label, primaryButton, secondaryButton, sectionTitle } from "@/lib/portalStyles";

const UNASSIGNED = "__unassigned__";

interface Driver {
  id: string;
  name: string;
}

interface PreviewData {
  orders: {
    id: string;
    patientName: string;
    address: string;
    zone: string;
    price: number;
    date: string;
  }[];
  total: number;
  driverName: string;
}

export default function InvoiceGenerator({
  storeSlug,
  drivers,
}: {
  storeSlug: string;
  drivers: Driver[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const driverQueryValue =
    selectedDriver === UNASSIGNED ? "unassigned" : selectedDriver;

  const resolvedDriverName =
    selectedDriver === UNASSIGNED
      ? "Unassigned"
      : drivers.find((d) => d.id === selectedDriver)?.name ?? "";

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!selectedDriver) {
      setError("Please select a driver before generating an invoice.");
      return;
    }
    setLoading(true);
    setPreview(null);

    const qs = new URLSearchParams({
      start: periodStart,
      end: periodEnd,
      driverId: driverQueryValue,
    });
    const res = await fetch(`/api/${storeSlug}/invoices/preview?${qs}`);

    if (!res.ok) {
      setError("Failed to load preview");
    } else {
      const data = await res.json();
      setPreview({ ...data, driverName: resolvedDriverName });
    }
    setLoading(false);
  };

  const generateInvoice = async () => {
    if (!preview || !selectedDriver) return;
    setLoading(true);

    const res = await fetch(`/api/${storeSlug}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart,
        periodEnd,
        driverId: driverQueryValue,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || "Failed to generate invoice");
    } else {
      setPreview(null);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className={`${card} p-6`}>
      <h2 className={`${sectionTitle} mb-4`}>Generate Invoice</h2>
      <form onSubmit={handlePreview} className="space-y-3">
        {error && <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
        <div>
          <label className={label}>
            Driver <span className="text-rose-500">*</span>
          </label>
          <select
            required
            value={selectedDriver}
            onChange={(e) => {
              setSelectedDriver(e.target.value);
              setPreview(null);
            }}
            className={input}
          >
            <option value="">Select a driver…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value={UNASSIGNED}>Unassigned</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Invoice will include only this driver&rsquo;s completed deliveries.
          </p>
        </div>
        <div>
          <label className={label}>Period Start</label>
          <input
            type="date"
            required
            value={periodStart}
            onChange={(e) => {
              setPeriodStart(e.target.value);
              setPreview(null);
            }}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Period End</label>
          <input
            type="date"
            required
            value={periodEnd}
            onChange={(e) => {
              setPeriodEnd(e.target.value);
              setPreview(null);
            }}
            className={input}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`${primaryButton} w-full`}
        >
          {loading ? "Loading..." : "Preview"}
        </button>
      </form>

      <a
        href={`/api/${storeSlug}/orders/export`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${secondaryButton} block w-full text-center mt-3`}
      >
        Export Uninvoiced (CSV)
      </a>

      {preview && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-600">
            Driver: <span className="text-[#1e3a8a]">{preview.driverName}</span>
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {preview.orders.length} delivered/attempted order
            {preview.orders.length === 1 ? "" : "s"}
          </p>
          <p className="text-lg font-bold text-[#1e3a8a] mt-1">
            Total: ${preview.total.toFixed(2)}
          </p>
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
            {preview.orders.map((o) => (
              <div key={o.id} className="text-xs text-slate-500">
                {o.date} — {o.patientName} — {o.zone} — ${o.price.toFixed(2)}
              </div>
            ))}
          </div>
          <button
            onClick={generateInvoice}
            disabled={loading || preview.orders.length === 0}
            className={`${primaryButton} w-full mt-3`}
          >
            {loading ? "Generating..." : "Generate Invoice"}
          </button>
        </div>
      )}
    </div>
  );
}
