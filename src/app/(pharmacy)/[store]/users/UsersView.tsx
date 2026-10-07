import type { ComponentProps } from "react";
import UserForm from "./UserForm";
import UserTable from "./UserTable";
import { pageTitle } from "@/lib/portalStyles";

// Presentational screen; the page supplies the data. Kept separate so the
// dev-only style guide can render it from fixtures.
export default function UsersView({
  storeSlug,
  users,
}: {
  storeSlug: string;
  users: ComponentProps<typeof UserTable>["users"];
}) {
  return (
    <div>
      <h1 className={`${pageTitle} mb-6`}>
        User Management, <span className="italic font-semibold">clear</span>
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <UserForm storeSlug={storeSlug} />
        </div>
        <div className="lg:col-span-2">
          <UserTable
            users={users}
            storeSlug={storeSlug}
          />
        </div>
      </div>
    </div>
  );
}
