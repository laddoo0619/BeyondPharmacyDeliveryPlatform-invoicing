import { prisma } from "@/lib/db";
import InvoiceGenerator from "./InvoiceGenerator";
import InvoiceList from "./InvoiceList";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      lineItems: true,
      generatedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Invoices & Reporting
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <InvoiceGenerator />
        </div>
        <div className="lg:col-span-2">
          <InvoiceList
            invoices={invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              periodStart: inv.periodStart.toISOString(),
              periodEnd: inv.periodEnd.toISOString(),
              totalAmount: inv.totalAmount,
              status: inv.status,
              lineItemCount: inv.lineItems.length,
              createdAt: inv.createdAt.toISOString(),
              generatedBy: inv.generatedBy.name,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
