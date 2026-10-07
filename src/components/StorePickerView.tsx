import Image from "next/image";
import Link from "next/link";
import Circles from "@/components/ui/Circles";
import logo from "@/assets/beyond-pharmacy-logo.png";
import { cn, selectableRow } from "@/lib/portalStyles";

// The admin's store picker. Presentational, so the dev-only style guide can
// render it from fixtures.
export default function StorePickerView({
  stores,
}: {
  stores: { id: string; slug: string; name: string }[];
}) {
  return (
    <div className="circle-host min-h-screen overflow-x-clip flex items-center justify-center bg-white">
      <Circles variant="hero" />
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h1 className="drop-in">
            <Image src={logo} alt="Beyond Pharmacy" priority className="mx-auto h-8 w-auto" />
          </h1>
          <p className="drop-in drop-in--2 mt-3 text-sm font-medium text-ink">Select a store to manage</p>
        </div>

        <div className="drop-in drop-in--3 space-y-3">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/${store.slug}/dashboard`}
              className={cn(selectableRow, "block w-full p-4 shadow-soft")}
            >
              <h2 className="text-lg font-bold text-navy">{store.name}</h2>
              <p className="text-sm text-ink mt-1">View dashboard &rarr;</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
