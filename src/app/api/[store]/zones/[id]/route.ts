import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify zone belongs to store
  const existing = await prisma.deliveryZone.findUnique({ where: { id, storeId: store.id } });
  if (!existing) {
    return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  }

  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  if (body.price !== undefined) updateData.price = body.price;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const zone = await prisma.deliveryZone.update({
    where: { id, storeId: store.id },
    data: updateData,
  });

  return NextResponse.json(zone);
}
