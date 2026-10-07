import DriverNav from "@/components/DriverNav";
import { driverMain, portalShell } from "@/lib/portalStyles";

// The driver portal's frame. Shared by the real layout and the dev-only style
// guide so both render the exact same shell.
export default function DriverShell({
  storeSlug,
  navBasePath,
  children,
}: {
  storeSlug: string;
  navBasePath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={portalShell}>
      <DriverNav storeSlug={storeSlug} basePath={navBasePath} />
      <main className={driverMain}>{children}</main>
    </div>
  );
}
