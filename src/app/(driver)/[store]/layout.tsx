import DriverShell from "@/components/DriverShell";
import { resolveStore } from "@/lib/store";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy mb-2">Service Unavailable</h1>
          <p className="text-ink">Unable to load store information. Please try again later.</p>
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

  return <DriverShell storeSlug={store.slug}>{children}</DriverShell>;
}
