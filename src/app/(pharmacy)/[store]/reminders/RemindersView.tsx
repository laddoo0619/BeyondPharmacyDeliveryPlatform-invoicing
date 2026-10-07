import type { ComponentProps } from "react";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";
import { pageTitle, mutedText } from "@/lib/portalStyles";

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
      <div>
        <h1 className={pageTitle}>Reminders</h1>
        <p className={mutedText}>
          Pop up on the day you choose, from 10 AM onward — fridge items, callbacks,
          anything the team needs to catch before a delivery goes out.
        </p>
      </div>

      <ReminderForm storeSlug={storeSlug} profiles={profiles} />
      <ReminderList
        storeSlug={storeSlug}
        reminders={reminders}
      />
    </div>
  );
}
