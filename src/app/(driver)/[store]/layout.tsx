import DriverNav from "@/components/DriverNav";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";

export default async function DriverLayout({
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
      <DriverNav storeSlug={store.slug} />
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
