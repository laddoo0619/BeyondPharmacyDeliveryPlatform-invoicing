import type { ComponentProps } from "react";
import InvoiceGenerator from "./InvoiceGenerator";
import InvoiceList from "./InvoiceList";
import PageHeader from "@/components/ui/PageHeader";
import { pageTitle } from "@/lib/portalStyles";

// Presentational screen; the page supplies the data. Kept separate so the
// dev-only style guide can render it from fixtures.
export default function InvoicesView({
  storeSlug,
  drivers,
  invoices,
}: {
  storeSlug: string;
  drivers: ComponentProps<typeof InvoiceGenerator>["drivers"];
  invoices: ComponentProps<typeof InvoiceList>["invoices"];
}) {
  return (
    <div>
      <PageHeader className="mb-8">
        <h1 className={pageTitle}>
          Invoices &amp; <span className="accent">Reporting</span>
        </h1>
      </PageHeader>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <InvoiceGenerator storeSlug={storeSlug} drivers={drivers} />
        </div>
        <div className="lg:col-span-2">
          <InvoiceList
            storeSlug={storeSlug}
            invoices={invoices}
          />
        </div>
      </div>
    </div>
  );
}
