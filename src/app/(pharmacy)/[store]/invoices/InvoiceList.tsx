"use client";

import {
  card,
  emptyState,
  sectionTitle,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: string;
  lineItemCount: number;
  createdAt: string;
  generatedBy: string;
  driverName: string | null;
}

export default function InvoiceList({
  invoices,
  storeSlug,
}: {
  invoices: InvoiceItem[];
  storeSlug: string;
}) {
  const downloadPdf = async (invoiceId: string) => {
    const res = await fetch(`/api/${storeSlug}/invoices/${invoiceId}/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-6 py-4 border-b">
        <h2 className={sectionTitle}>Generated Invoices</h2>
      </div>
      {invoices.length === 0 ? (
        <div className={emptyState}>
          No invoices <span className="italic text-[#1e3a8a]">generated</span> yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={tableHeader}>
              <tr>
                <th className="px-6 py-3">Invoice #</th>
                <th className="px-6 py-3">Driver</th>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">Items</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((inv) => (
                <tr key={inv.id} className={tableRow}>
                <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">{inv.invoiceNumber}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {inv.driverName ?? <span className="text-slate-400 italic">All drivers</span>}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{inv.lineItemCount}</td>
                <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">${inv.totalAmount.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={statusBadgeClasses(inv.status)}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => downloadPdf(inv.id)} className="text-xs text-[#6f8f72] hover:text-[#5f7d62] font-semibold">Download PDF</button>
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
