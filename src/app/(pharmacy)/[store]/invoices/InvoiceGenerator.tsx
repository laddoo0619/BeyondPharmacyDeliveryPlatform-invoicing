"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceGenerator({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    orders: { id: string; patientName: string; address: string; zone: string; price: number; date: string }[];
    total: number;
  } | null>(null);

  const handlePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const periodStart = formData.get("periodStart") as string;
    const periodEnd = formData.get("periodEnd") as string;

    const res = await fetch(`/api/${storeSlug}/invoices/preview?start=${periodStart}&end=${periodEnd}`);

    if (!res.ok) {
      setError("Failed to load preview");
    } else {
      const data = await res.json();
      setPreview(data);
    }
    setLoading(false);
  };

  const generateInvoice = async () => {
    if (!preview) return;
    setLoading(true);

    const form = document.querySelector("form") as HTMLFormElement;
    const formData = new FormData(form);

    const res = await fetch(`/api/${storeSlug}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart: formData.get("periodStart"),
        periodEnd: formData.get("periodEnd"),
      }),
    });

    if (!res.ok) {
      setError("Failed to generate invoice");
    } else {
      setPreview(null);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Generate Invoice</h2>
      <form onSubmit={handlePreview} className="space-y-3">
        {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
          <input name="periodStart" type="date" required className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
          <input name="periodEnd" type="date" required className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-gray-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
          {loading ? "Loading..." : "Preview"}
        </button>
      </form>

      <a
        href={`/api/${storeSlug}/orders/export`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center mt-3 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
      >
        Export Uninvoiced (CSV)
      </a>

      {preview && (
        <div className="mt-4 border-t pt-4">
          <p className="text-sm font-medium text-gray-700">{preview.orders.length} delivered orders</p>
          <p className="text-lg font-bold text-gray-900 mt-1">Total: ${preview.total.toFixed(2)}</p>
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
            {preview.orders.map((o) => (
              <div key={o.id} className="text-xs text-gray-500">
                {o.date} — {o.patientName} — {o.zone} — ${o.price.toFixed(2)}
              </div>
            ))}
          </div>
          <button onClick={generateInvoice} disabled={loading} className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Generating..." : "Generate Invoice"}
          </button>
        </div>
      )}
    </div>
  );
}
