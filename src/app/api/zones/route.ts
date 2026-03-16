import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, price } = await req.json();

  if (!name || price === undefined) {
    return NextResponse.json({ error: "Name and price required" }, { status: 400 });
  }

  const existing = await prisma.deliveryZone.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Zone already exists" }, { status: 400 });
  }

  const zone = await prisma.deliveryZone.create({
    data: { name, price },
  });

  return NextResponse.json(zone, { status: 201 });
}

export async function GET() {
  const zones = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(zones);
}
