import PharmacyNav from "@/components/PharmacyNav";
import ReminderPopup from "@/components/ReminderPopup";
import { portalMain, portalShell } from "@/lib/portalStyles";

// The pharmacy portal's frame: header, page body and the daily reminder popup.
// Shared by the real layout and the dev-only style guide so both render the
// exact same shell.
export default function PharmacyShell({
  storeSlug,
  storeName,
  navBasePath,
  children,
}: {
  storeSlug: string;
  storeName: string;
  navBasePath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={portalShell}>
      <PharmacyNav storeSlug={storeSlug} storeName={storeName} basePath={navBasePath} />
      <main className={portalMain}>{children}</main>
      {/* Staff reminders for the day — renders itself only from 10 AM, and
          only when something is actually outstanding. */}
      <ReminderPopup storeSlug={storeSlug} />
    </div>
  );
}
