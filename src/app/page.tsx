import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import StorePickerView from "@/components/StorePickerView";

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

  return <StorePickerView stores={stores} />;
}
