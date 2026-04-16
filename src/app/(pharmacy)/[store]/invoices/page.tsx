import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import InvoiceGenerator from "./InvoiceGenerator";
import InvoiceList from "./InvoiceList";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const [invoices, drivers] = await Promise.all([
    prisma.invoice.findMany({
      where: { storeId: store.id },
      include: { lineItems: true, generatedBy: true, driver: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "DRIVER", isActive: true, storeId: store.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invoices & Reporting</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <InvoiceGenerator storeSlug={storeSlug} drivers={drivers} />
        </div>
        <div className="lg:col-span-2">
          <InvoiceList
            storeSlug={storeSlug}
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
              driverName: inv.driver?.name ?? null,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
