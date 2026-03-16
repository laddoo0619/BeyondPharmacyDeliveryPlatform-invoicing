import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get start of current week (Sunday)
  const now = new Date();
  const day = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);

  const skip = await prisma.recurringOrderSkip.create({
    data: {
      recurringOrderId: id,
      skipDate: startOfWeek,
      reason: "Patient picked up in-store",
      createdById: session.user.id,
    },
  });

  return NextResponse.json(skip, { status: 201 });
}
