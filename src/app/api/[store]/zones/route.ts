import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, price } = await req.json();

  if (!name || price === undefined) {
    return NextResponse.json({ error: "Name and price required" }, { status: 400 });
  }

  const existing = await prisma.deliveryZone.findUnique({
    where: { name_storeId: { name, storeId: store.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Zone already exists" }, { status: 400 });
  }

  const zone = await prisma.deliveryZone.create({
    data: { name, price, storeId: store.id },
  });

  return NextResponse.json(zone, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const zones = await prisma.deliveryZone.findMany({
    where: { isActive: true, storeId: store.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(zones);
}
