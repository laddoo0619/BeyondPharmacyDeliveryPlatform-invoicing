import { NextRequest, NextResponse } from "next/server";
import {
  formatGenerationMessage,
  generateRecurringOrders,
  getVancouverDeliveryDateInfo,
  isVancouverSixAmWindow,
} from "@/lib/cron";

export const dynamic = "force-dynamic";
// The run dispatches every due recurring order sequentially (Spoke caps writes at
// 5 req/s, so 429 retries with backoff are expected); the platform default duration
// can kill the function mid-loop and silently drop the rest of the day's orders.
export const maxDuration = 60;

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

  const now = new Date();
  const deliveryDate = getVancouverDeliveryDateInfo(now);

  if (!isVancouverSixAmWindow(now)) {
    return NextResponse.json({
      skipped: true,
      reason: "Outside the 6 AM America/Vancouver generation window",
      dateKey: deliveryDate.dateKey,
    });
  }

  const result = await generateRecurringOrders(now);

  return NextResponse.json({
    success: true,
    ...result,
    message: formatGenerationMessage(result),
  });
}
