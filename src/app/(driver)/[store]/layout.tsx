import DriverNav from "@/components/DriverNav";
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Service Unavailable</h1>
          <p className="text-gray-600">Unable to load store information. Please try again later.</p>
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
    <div className="min-h-screen bg-gray-50">
      <DriverNav storeSlug={store.slug} />
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
