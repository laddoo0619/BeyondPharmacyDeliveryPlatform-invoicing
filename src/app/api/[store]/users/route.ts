import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import bcrypt from "bcryptjs";

export async function DELETE(
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

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Only allow deleting drivers, not other admins
  if (user.role !== "DRIVER") {
    return NextResponse.json({ error: "Can only delete driver accounts" }, { status: 400 });
  }

  // Verify the driver belongs to this store
  if (user.storeId !== store.id) {
    return NextResponse.json({ error: "Driver not found in this store" }, { status: 404 });
  }

  // Soft-delete: deactivate driver and clean up references
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Remove as default driver from any zones
    await tx.deliveryZone.updateMany({
      where: { defaultDriverId: userId, storeId: store.id },
      data: { defaultDriverId: null },
    });

    // Unassign from future pending/assigned orders
    await tx.order.updateMany({
      where: {
        assignedDriverId: userId,
        storeId: store.id,
        status: { in: ["PENDING", "ASSIGNED"] },
      },
      data: { assignedDriverId: null, status: "PENDING" },
    });
  });

  return NextResponse.json({ message: "Driver account deactivated" });
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

  const { name, email, password, role, phone } = await req.json();

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      phone: phone || null,
      storeId: role === "DRIVER" ? store.id : null,
    },
  });

  return NextResponse.json(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    { status: 201 }
  );
}
