import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};

  if (body.status) updateData.status = body.status;
  if (body.assignedDriverId) updateData.assignedDriverId = body.assignedDriverId;

  const order = await prisma.order.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(order);
}
