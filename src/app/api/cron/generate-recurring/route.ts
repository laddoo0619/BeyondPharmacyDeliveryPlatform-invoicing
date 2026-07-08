import { NextRequest, NextResponse, after } from "next/server";
import {
  formatGenerationMessage,
  generateRecurringOrders,
  getVancouverDeliveryDateInfo,
  isVancouverSixAmWindow,
} from "@/lib/cron";

export const dynamic = "force-dynamic";
// Spoke caps writes at 5 req/s, so large dispatch batches are slow by design.
// The in-code time budget stops each run before this platform limit, and the
// route chains continuation invocations until every profile is processed.
export const maxDuration = 300;

// One leg's processing budget — safely inside maxDuration.
const LEG_TIME_BUDGET_MS = 280_000;
// Hard cap on chained continuations (leg 0 + 5 continuations ≈ 28 minutes of
// processing). Guarantees termination even if runs keep reporting work.
const MAX_CONTINUATIONS = 5;

function parseContinuation(value: string | null) {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return Math.min(parsed, MAX_CONTINUATIONS);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attempt = parseContinuation(req.nextUrl.searchParams.get("continuation"));
  const now = new Date();
  const deliveryDate = getVancouverDeliveryDateInfo(now);

  // Continuation legs bypass the window check — a chain started at 6 AM must
  // not die because a later leg lands after 6:59.
  if (attempt === 0 && !isVancouverSixAmWindow(now)) {
    return NextResponse.json({
      skipped: true,
      reason: "Outside the 6 AM America/Vancouver generation window",
      dateKey: deliveryDate.dateKey,
    });
  }

  const result = await generateRecurringOrders(now, {
    timeBudgetMs: LEG_TIME_BUDGET_MS,
    // Stalled-dispatch alerts fire at most once per day, on the first leg.
    runStallWatchdog: attempt === 0,
    autoContinuing: attempt < MAX_CONTINUATIONS,
    // Staff get one heads-up on the first incomplete leg and one more if the
    // chain exhausts; middle legs stay silent.
    notifyOnIncomplete: attempt === 0 || attempt >= MAX_CONTINUATIONS,
  });

  if (result.unprocessed > 0 && attempt < MAX_CONTINUATIONS) {
    const base =
      process.env.AUTH_URL?.trim().replace(/\/$/, "") || req.nextUrl.origin;
    const kickUrl = `${base}/api/cron/generate-recurring?continuation=${attempt + 1}`;

    // Kick the next leg after this response is sent. The short abort only
    // closes our side of the connection — once the request reaches the
    // deployment, the continuation invocation runs to completion on its own.
    after(async () => {
      console.log(
        `[CRON] Starting continuation ${attempt + 1} for ${result.unprocessed} remaining profile(s)`
      );
      try {
        await fetch(kickUrl, {
          headers: { authorization: `Bearer ${cronSecret}` },
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
      } catch (err) {
        // TimeoutError is the expected path (we abort our side on purpose).
        if (!(err instanceof Error && err.name === "TimeoutError")) {
          console.error("[CRON] Failed to start continuation run:", err);
        }
      }
    });
  }

  return NextResponse.json({
    success: true,
    continuation: attempt,
    ...result,
    message: formatGenerationMessage(result),
  });
}
