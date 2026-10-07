import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import InvoicesView from "./InvoicesView";

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
    <InvoicesView
      storeSlug={storeSlug}
      drivers={drivers}
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
  );
}
