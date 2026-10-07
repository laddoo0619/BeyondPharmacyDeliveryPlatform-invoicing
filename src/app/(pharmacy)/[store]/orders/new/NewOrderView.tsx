import type { ComponentProps } from "react";
import NewOrderForm from "./NewOrderForm";
import { pageTitle } from "@/lib/portalStyles";

// Presentational screen; the page supplies the data. Kept separate so the
// dev-only style guide can render it from fixtures.
export default function NewOrderView(props: ComponentProps<typeof NewOrderForm>) {
  return (
    <div>
      <h1 className={`${pageTitle} mb-6`}>
        Create New <span className="italic font-semibold">Order</span>
      </h1>
      <NewOrderForm {...props} />
    </div>
  );
}
