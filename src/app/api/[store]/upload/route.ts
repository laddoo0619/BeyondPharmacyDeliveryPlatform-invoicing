import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { put } from "@vercel/blob";

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
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const orderId = formData.get("orderId") as string;
  const notes = formData.get("notes") as string;

  if (!file || !orderId) {
    return NextResponse.json(
      { error: "File and orderId required" },
      { status: 400 }
    );
  }

  // Verify order belongs to store and is assigned to this driver
  const order = await prisma.order.findUnique({ where: { id: orderId, storeId: store.id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.assignedDriverId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upload to Vercel Blob
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `pod/${orderId}-${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });

  // Create proof of delivery record
  const pod = await prisma.proofOfDelivery.create({
    data: {
      orderId,
      photoUrl: blob.url,
      deliveredById: session.user.id,
      notes: notes || null,
    },
  });

  return NextResponse.json(pod, { status: 201 });
}
