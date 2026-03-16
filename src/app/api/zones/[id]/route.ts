import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  if (body.price !== undefined) updateData.price = body.price;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const zone = await prisma.deliveryZone.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(zone);
}
