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

  // Verify order belongs to store and is assigned to this driver
  const order = await prisma.order.findUnique({ where: { id: orderId, storeId: store.id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.assignedDriverId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  try {
    // Save file
    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${orderId}-${Date.now()}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();

    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    await writeFile(filepath, Buffer.from(bytes));

    // Create or update proof of delivery record (upsert handles retries)
    const pod = await prisma.proofOfDelivery.upsert({
      where: { orderId },
      update: {
        photoUrl: `/uploads/${filename}`,
        deliveredById: session.user.id,
        deliveredAt: new Date(),
        notes: notes || null,
      },
      create: {
        orderId,
        photoUrl: `/uploads/${filename}`,
        deliveredById: session.user.id,
        notes: notes || null,
      },
    });

    return NextResponse.json(pod, { status: 201 });
  } catch (err) {
    console.error("Upload failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save proof of delivery: ${message}` },
      { status: 500 }
    );
  }
}
