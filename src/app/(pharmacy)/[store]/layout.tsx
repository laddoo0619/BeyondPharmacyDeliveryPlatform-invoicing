import PharmacyNav from "@/components/PharmacyNav";
import { resolveStore } from "@/lib/store";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

export default async function PharmacyLayout({
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
    console.error("[PharmacyLayout] Store resolution error:", error);
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

  // Verify user belongs to this store
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Drivers should use the driver portal, not pharmacy
  if (session.user.role === "DRIVER") {
    redirect(`/${session.user.storeSlug || storeSlug}/deliveries`);
  }

  // Admins with a specific store assignment can only access their store
  // Admins without storeId (super-admins) can access any store
  if (session.user.storeId && session.user.storeId !== store.id) {
    if (session.user.storeSlug) {
      redirect(`/${session.user.storeSlug}/dashboard`);
    }
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PharmacyNav storeSlug={store.slug} storeName={store.name} />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
