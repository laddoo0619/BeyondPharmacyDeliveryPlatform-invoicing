import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { formatGenerationMessage, generateRecurringOrders } from "@/lib/cron";

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

  const result = await generateRecurringOrders();

  return NextResponse.json({
    ...result,
    message: formatGenerationMessage(result),
  });
}
