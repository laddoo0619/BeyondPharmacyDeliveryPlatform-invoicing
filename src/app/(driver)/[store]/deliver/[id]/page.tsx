import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { notFound } from "next/navigation";
import DeliveryDetailView from "./DeliveryDetailView";

export default async function DeliverPage({
  params,
}: {
  params: Promise<{ store: string; id: string }>;
}) {
  const { store: storeSlug, id } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const session = await auth();
  if (!session?.user) return null;

  const order = await prisma.order.findUnique({
    where: { id, assignedDriverId: session.user.id },
  });

  if (!order || order.storeId !== store.id || order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "PENDING") {
    notFound();
  }

  return <DeliveryDetailView storeSlug={store.slug} order={order} />;
}
