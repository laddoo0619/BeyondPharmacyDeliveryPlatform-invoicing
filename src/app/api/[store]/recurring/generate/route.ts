import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { formatGenerationMessage, generateRecurringOrders } from "@/lib/cron";

// Same time budget as the cron route: the generation loop's Spoke dispatches
// (with 429 retry/backoff) must not be killed mid-run by the platform default.
export const maxDuration = 60;

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

  const result = await generateRecurringOrders(new Date(), {
    // Shorter budget: an admin is waiting on this response, and the returned
    // message guides a follow-up click. Auto-continuation is the cron's job.
    timeBudgetMs: 50_000,
    // Stalled-dispatch alerts only fire on the first 6 AM cron leg — repeated
    // manual clicks must not duplicate them.
    runStallWatchdog: false,
  });

  return NextResponse.json({
    ...result,
    message: formatGenerationMessage(result),
  });
}
