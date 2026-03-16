import PharmacyNav from "@/components/PharmacyNav";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";

export default async function PharmacyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <PharmacyNav storeSlug={store.slug} storeName={store.name} />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
