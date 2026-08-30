import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { requireStoreAdmin } from "@/lib/storeAccess";
import { addWeeks, toReminderView } from "@/lib/reminders";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const completed = body?.completed === true;

  const existing = await prisma.reminder.findFirst({
    where: { id, storeId: access.store.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  const updated = await prisma.reminder.update({
    where: { id: existing.id },
    data: {
      completedAt: completed ? new Date() : null,
      completedById: completed ? access.session.user.id : null,
    },
  });

  // Ticking off a repeating reminder schedules the next one, so a monthly
  // fridge item is entered once instead of every month. Guarded by
  // sourceReminderId so un-ticking and re-ticking can't build a chain of
  // duplicates.
  let nextRemindOn: string | null = null;
  if (completed && existing.repeatIntervalWeeks && existing.repeatIntervalWeeks > 0) {
    const alreadySpawned = await prisma.reminder.findFirst({
      where: { sourceReminderId: existing.id },
      select: { id: true, remindOn: true },
    });

    if (alreadySpawned) {
      nextRemindOn = alreadySpawned.remindOn.toISOString().slice(0, 10);
    } else {
      const next = await prisma.reminder.create({
        data: {
          note: existing.note,
          patientName: existing.patientName,
          recurringOrderId: existing.recurringOrderId,
          remindOn: addWeeks(existing.remindOn, existing.repeatIntervalWeeks),
          repeatIntervalWeeks: existing.repeatIntervalWeeks,
          sourceReminderId: existing.id,
          storeId: access.store.id,
          createdById: access.session.user.id,
        },
      });
      nextRemindOn = next.remindOn.toISOString().slice(0, 10);
    }
  }

  const { dayStart } = getVancouverDeliveryDateInfo();
  return NextResponse.json({ ...toReminderView(updated, dayStart), nextRemindOn });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;

  // Scoped delete: an id from another store matches nothing rather than being
  // removed.
  const deleted = await prisma.reminder.deleteMany({
    where: { id, storeId: access.store.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
