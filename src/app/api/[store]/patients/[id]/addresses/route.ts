import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { z } from "zod";
import { createOrReuseSavedAddress } from "@/lib/patientAddressRecords";

const createAddressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  label: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id: patientId } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, storeId: store.id },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const addresses = await prisma.address.findMany({
    where: { patientId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(addresses);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id: patientId } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, storeId: store.id },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const address = await prisma.$transaction(async (tx) => {
    const savedAddress = await createOrReuseSavedAddress(
      tx,
      patientId,
      {
        label: data.label || (data.isDefault ? "Primary" : "Saved"),
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
      },
      { label: data.label || (data.isDefault ? "Primary" : "Saved"), isDefault: data.isDefault }
    );

    if (savedAddress.isDefault) {
      await tx.patient.update({
        where: { id: patientId },
        data: {
          address: savedAddress.address,
          city: savedAddress.city,
          postalCode: savedAddress.postalCode,
        },
      });
    }

    return savedAddress;
  });

  return NextResponse.json(address, { status: 201 });
}
