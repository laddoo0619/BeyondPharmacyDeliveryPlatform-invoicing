import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import UsersView from "./UsersView";

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
    <UsersView
      storeSlug={storeSlug}
      users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              isActive: u.isActive,
              store: u.store ? { name: u.store.name } : null,
            }))}
    />
  );
}
