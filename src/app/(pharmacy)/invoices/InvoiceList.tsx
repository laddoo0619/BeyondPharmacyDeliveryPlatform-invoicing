"use client";

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
}

export default function InvoiceList({
  invoices,
}: {
  invoices: InvoiceItem[];
}) {
  const downloadPdf = async (invoiceId: string) => {
    const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
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
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Generated Invoices</h2>
      </div>
      {invoices.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500">
          No invoices generated yet.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Invoice #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {inv.invoiceNumber}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                  {new Date(inv.periodEnd).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {inv.lineItemCount}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  ${inv.totalAmount.toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      inv.status === "FINALIZED"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => downloadPdf(inv.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
