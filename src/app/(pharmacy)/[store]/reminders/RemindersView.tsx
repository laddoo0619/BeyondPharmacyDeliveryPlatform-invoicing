import type { ComponentProps } from "react";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";
import PageHeader from "@/components/ui/PageHeader";
import { pageTitle } from "@/lib/portalStyles";

// Presentational screen; the page supplies the data. Kept separate so the
// dev-only style guide can render it from fixtures.
export default function RemindersView({
  storeSlug,
  profiles,
  reminders,
}: {
  storeSlug: string;
  profiles: ComponentProps<typeof ReminderForm>["profiles"];
  reminders: ComponentProps<typeof ReminderList>["reminders"];
}) {
  return (
    <div className="space-y-6">
      <PageHeader className="mb-2">
        <h1 className={pageTitle}>Reminders</h1>
        <p className="drop-in drop-in--2 mt-3 max-w-3xl text-body font-medium leading-body text-ink">
          Pop up on the day you choose, from 10 AM onward — fridge items, callbacks,
          anything the team needs to catch before a delivery goes out.
        </p>
      </PageHeader>

      <ReminderForm storeSlug={storeSlug} profiles={profiles} />
      <ReminderList
        storeSlug={storeSlug}
        reminders={reminders}
      />
    </div>
  );
}
