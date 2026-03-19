import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function GET(
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

  const search = req.nextUrl.searchParams.get("search") || "";

  const patients = await prisma.patient.findMany({
    where: {
      storeId: store.id,
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(patients);
}

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

  const body = await req.json();

  if (!body.name || !body.address || !body.city || !body.postalCode) {
    return NextResponse.json(
      { error: "name, address, city, and postalCode are required" },
      { status: 400 }
    );
  }

  const patient = await prisma.patient.create({
    data: {
      name: body.name,
      phone: body.phone || null,
      address: body.address,
      city: body.city,
      postalCode: body.postalCode,
      storeId: store.id,
    },
  });

  return NextResponse.json(patient, { status: 201 });
}
