import PharmacyShell from "@/components/PharmacyShell";
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-navy mb-2">Service Unavailable</h1>
          <p className="text-ink">Unable to load store information. Please try again later.</p>
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
    <PharmacyShell storeSlug={store.slug} storeName={store.name}>
      {children}
    </PharmacyShell>
  );
}
