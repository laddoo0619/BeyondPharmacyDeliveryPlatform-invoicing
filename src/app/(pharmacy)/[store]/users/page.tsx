import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import UserForm from "./UserForm";
import UserTable from "./UserTable";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  // Show all admins (no storeId) and drivers for this store
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: "PHARMACY_ADMIN" },
        { storeId: store.id },
      ],
    },
    include: { store: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Management</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <UserForm storeSlug={storeSlug} />
        </div>
        <div className="lg:col-span-2">
          <UserTable
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              isActive: u.isActive,
              store: u.store ? { name: u.store.name } : null,
            }))}
            storeSlug={storeSlug}
          />
        </div>
      </div>
    </div>
  );
}
