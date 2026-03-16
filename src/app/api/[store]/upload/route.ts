import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

  // Verify order belongs to store before saving upload
  const order = await prisma.order.findUnique({ where: { id: orderId, storeId: store.id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Save file
  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${orderId}-${Date.now()}.${ext}`;
  const filepath = path.join(uploadsDir, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));

  // Create proof of delivery record
  const pod = await prisma.proofOfDelivery.create({
    data: {
      orderId,
      photoUrl: `/uploads/${filename}`,
      deliveredById: session.user.id,
      notes: notes || null,
    },
  });

  return NextResponse.json(pod, { status: 201 });
}
