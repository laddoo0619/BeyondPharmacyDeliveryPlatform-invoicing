import DriverNav from "@/components/DriverNav";
import { resolveStore } from "@/lib/store";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { driverMain, portalShell } from "@/lib/portalStyles";

export default async function DriverLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;

  let store;
  try {
    store = await resolveStore(storeSlug);
  } catch (error) {
    console.error("[DriverLayout] Store resolution error:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-sky-50 to-emerald-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1e3a8a] mb-2">Service Unavailable</h1>
          <p className="text-slate-500">Unable to load store information. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (!store) notFound();

  // Verify driver belongs to this store
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.storeId && session.user.storeId !== store.id) {
    // Redirect driver to their assigned store
    if (session.user.storeSlug) {
      redirect(`/${session.user.storeSlug}/deliveries`);
    }
    redirect("/");
  }

  return (
    <div className={portalShell}>
      <DriverNav storeSlug={store.slug} />
      <main className={driverMain}>{children}</main>
    </div>
  );
}
