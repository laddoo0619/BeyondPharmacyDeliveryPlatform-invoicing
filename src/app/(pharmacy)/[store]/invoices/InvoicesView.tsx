import type { ComponentProps } from "react";
import InvoiceGenerator from "./InvoiceGenerator";
import InvoiceList from "./InvoiceList";
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
      <h1 className={`${pageTitle} mb-6`}>
        Invoices &amp; <span className="italic font-semibold">Reporting</span>
      </h1>
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
