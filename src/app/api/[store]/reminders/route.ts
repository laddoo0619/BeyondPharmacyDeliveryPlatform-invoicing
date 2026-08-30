import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { requireStoreAdmin } from "@/lib/storeAccess";
import {
  MAX_REMINDER_NOTE,
  getDueReminders,
  parseReminderDateKey,
  toReminderView,
} from "@/lib/reminders";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;

  // The popup only needs what's due; the Reminders page wants the full list.
  if (req.nextUrl.searchParams.get("scope") === "due") {
    return NextResponse.json(await getDueReminders(access.store.id));
  }

  const { dayStart } = getVancouverDeliveryDateInfo();
  const reminders = await prisma.reminder.findMany({
    where: { storeId: access.store.id },
    orderBy: [{ completedAt: "asc" }, { remindOn: "asc" }],
    take: 200,
    select: {
      id: true,
      note: true,
      patientName: true,
      remindOn: true,
      repeatIntervalWeeks: true,
      completedAt: true,
    },
  });

  return NextResponse.json({
    items: reminders.map((r) => toReminderView(r, dayStart)),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const remindOn = parseReminderDateKey(body?.remindOn);
  const patientName =
    typeof body?.patientName === "string" && body.patientName.trim()
      ? body.patientName.trim()
      : null;
  const recurringOrderId =
    typeof body?.recurringOrderId === "string" && body.recurringOrderId.trim()
      ? body.recurringOrderId.trim()
      : null;

  if (!note) {
    return NextResponse.json({ error: "A reminder note is required" }, { status: 400 });
  }
  if (note.length > MAX_REMINDER_NOTE) {
    return NextResponse.json(
      { error: `Keep the note under ${MAX_REMINDER_NOTE} characters` },
      { status: 400 }
    );
  }
  if (!remindOn) {
    return NextResponse.json(
      { error: "A valid reminder date (YYYY-MM-DD) is required" },
      { status: 400 }
    );
  }

  // null / 0 = one-off. Anything else must be a sane weekly interval.
  const rawRepeat = body?.repeatIntervalWeeks;
  let repeatIntervalWeeks: number | null = null;
  if (rawRepeat !== null && rawRepeat !== undefined && rawRepeat !== "" && Number(rawRepeat) !== 0) {
    const weeks = Number(rawRepeat);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      return NextResponse.json(
        { error: "Repeat interval must be a whole number of weeks between 1 and 52" },
        { status: 400 }
      );
    }
    repeatIntervalWeeks = weeks;
  }

  const created = await prisma.reminder.create({
    data: {
      note,
      patientName,
      recurringOrderId,
      remindOn,
      repeatIntervalWeeks,
      storeId: access.store.id,
      createdById: access.session.user.id,
    },
  });

  const { dayStart } = getVancouverDeliveryDateInfo();
  return NextResponse.json(toReminderView(created, dayStart), { status: 201 });
}
