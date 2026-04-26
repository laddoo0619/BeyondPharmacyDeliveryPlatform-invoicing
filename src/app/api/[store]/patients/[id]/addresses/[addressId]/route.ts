import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { cleanAddressInput } from "@/lib/patientAddressRecords";

const updateAddressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string; addressId: string }> }
) {
  const { store: storeSlug, id: patientId, addressId } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, storeId: store.id },
    select: { id: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const existingAddress = await prisma.address.findFirst({
    where: { id: addressId, patientId },
  });

  if (!existingAddress) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  const data = cleanAddressInput(parsed.data);

  const updatedAddress = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({
        where: { patientId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.address.update({
      where: { id: addressId },
      data: {
        label: data.label,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        ...(parsed.data.isDefault !== undefined
          ? { isDefault: parsed.data.isDefault }
          : {}),
      },
    });

    if (updated.isDefault) {
      await tx.patient.update({
        where: { id: patientId },
        data: {
          address: updated.address,
          city: updated.city,
          postalCode: updated.postalCode,
        },
      });
    }

    return updated;
  });

  return NextResponse.json(updatedAddress);
}
