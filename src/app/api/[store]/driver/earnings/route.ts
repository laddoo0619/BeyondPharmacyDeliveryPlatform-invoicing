import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.storeId && session.user.storeId !== store.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Start and end dates required" },
      { status: 400 }
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      assignedDriverId: session.user.id,
      storeId: store.id,
      status: "DELIVERED",
      scheduledDate: {
        gte: new Date(start),
        lte: new Date(end + "T23:59:59.999Z"),
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const header = "Date,Patient,Address,City,Zone,Amount";
  const rows = orders.map((o) => {
    const date = new Date(o.scheduledDate).toISOString().split("T")[0];
    const escape = (s: string | null) =>
      s ? `"${s.replace(/"/g, '""')}"` : "";
    return [
      date,
      escape(o.patientName),
      escape(o.deliveryAddress),
      escape(o.deliveryCity),
      escape(o.deliveryZoneName),
      o.priceAtCreation.toFixed(2),
    ].join(",");
  });

  const total = orders.reduce((sum, o) => sum + o.priceAtCreation, 0);
  rows.push(`,,,,Total,"${total.toFixed(2)}"`);

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="my-earnings-${start}-to-${end}.csv"`,
    },
  });
}
