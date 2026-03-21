import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function Home() {
  let session;
  try {
    session = await auth();
  } catch (error) {
    console.error("[Home] Auth error:", error);
    redirect("/login");
  }

  if (!session?.user) {
    redirect("/login");
  }

  // Drivers go directly to their store's deliveries
  if (session.user.role === "DRIVER") {
    if (session.user.storeSlug) {
      redirect(`/${session.user.storeSlug}/deliveries`);
    }
    // Driver without store assignment — show error
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Store Assigned</h1>
          <p className="text-gray-600">Please contact your administrator to assign you to a store.</p>
        </div>
      </div>
    );
  }

  // Admins see store selector
  let stores;
  try {
    stores = await prisma.store.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("[Home] Database error:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Service Unavailable</h1>
          <p className="text-gray-600">Unable to load stores. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Beyond Pharmacy</h1>
          <p className="mt-2 text-sm text-gray-600">Select a store to manage</p>
        </div>

        <div className="space-y-3">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/${store.slug}/dashboard`}
              className="block w-full p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <h2 className="text-lg font-semibold text-gray-900">{store.name}</h2>
              <p className="text-sm text-gray-500 mt-1">View dashboard &rarr;</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
